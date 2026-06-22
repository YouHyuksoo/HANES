"use client";

/**
 * @file shipping/pack/components/BoxLabelModal.tsx
 * @description 박스 라벨 출력/재발행 모달.
 *  - 박스번호 바코드(code128, bwip-js) + 품목/수량/포장단위/일자/시리얼 목록을 인쇄용으로 렌더한다.
 *  - autoPrint=true 면 데이터 표시 후 자동으로 window.print() 1회 호출(포장단위 도달 자동출력용).
 *  - 라벨관리(/master/label) box 카테고리 템플릿 선택 가능.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Modal, Button, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { LabelDesign, createDefaultLabelDesign, ensureObjectLabelDesign } from "@/app/(authenticated)/master/label/types";
import { LabelDesignRenderer } from "@/app/(authenticated)/master/label/components/LabelDesignRenderer";
import api from "@/services/api";

/** 라벨 출력에 필요한 박스 정보(목록 grid의 enriched Box와 구조 호환) */
export interface BoxLabelInfo {
  boxNo: string;
  itemCode: string;
  itemName: string | null;
  qty: number;
  boxQty: number | null;
  serialList: string | null;
  closeAt: string | null;
  createdAt: string;
}

interface TemplateInfo {
  templateKey: string;
  templateName: string;
  category: string;
  printMode: string;
  designData: LabelDesign;
  isDefault?: boolean;
}

interface Props {
  isOpen: boolean;
  box: BoxLabelInfo | null;
  autoPrint?: boolean;
  onClose: () => void;
}

const DEFAULT_TEMPLATE_KEY = "__default__";

function parseSerials(serialList: string | null): string[] {
  if (!serialList) return [];
  try {
    const parsed = JSON.parse(serialList);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** bwip-js code128 바코드 캔버스 (박스번호 스캔용) */
function BoxBarcode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !value) return;
    let cancelled = false;
    (async () => {
      try {
        const bwipjs = await import("bwip-js");
        if (cancelled || !canvasRef.current) return;
        bwipjs.toCanvas(canvasRef.current, {
          bcid: "code128",
          text: value,
          scale: 3,
          height: 16,
          includetext: true,
          textxalign: "center",
        });
      } catch {
        /* 바코드 실패해도 라벨 텍스트는 표시됨 */
      }
    })();
    return () => { cancelled = true; };
  }, [value]);
  return <canvas ref={canvasRef} className="max-w-full" />;
}

export default function BoxLabelModal({ isOpen, box, autoPrint = false, onClose }: Props) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(DEFAULT_TEMPLATE_KEY);
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("box"));

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await api.get("/master/label-templates", { params: { category: "box" } });
        const rawTemplates = res.data?.data ?? [];
        const nextTemplates = rawTemplates.map((tpl: Record<string, unknown>) => {
          const rawDesign = typeof tpl.designData === "string" ? JSON.parse(tpl.designData as string) : tpl.designData;
          return {
            templateKey: tpl.templateKey ?? `${tpl.templateName}::${tpl.category}`,
            templateName: tpl.templateName,
            category: tpl.category,
            printMode: tpl.printMode ?? "BROWSER",
            designData: ensureObjectLabelDesign(rawDesign, "box"),
            isDefault: tpl.isDefault,
          } as TemplateInfo;
        });
        setTemplates(nextTemplates);
        const preferred = nextTemplates.find((item: TemplateInfo) => item.isDefault) ?? nextTemplates[0];
        if (preferred) {
          setSelectedTemplateKey(preferred.templateKey);
          setLabelDesign(preferred.designData);
        }
      } catch {
        setTemplates([]);
        setLabelDesign(createDefaultLabelDesign("box"));
      }
    })();
  }, [isOpen]);

  const handleTemplateChange = useCallback((templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (templateKey === DEFAULT_TEMPLATE_KEY) {
      setLabelDesign(createDefaultLabelDesign("box"));
      return;
    }
    const tpl = templates.find((item) => item.templateKey === templateKey);
    if (!tpl) return;
    setLabelDesign(ensureObjectLabelDesign(tpl.designData, "box"));
  }, [templates]);

  const templateOptions = useMemo<SelectOption[]>(() => [
    { value: DEFAULT_TEMPLATE_KEY, label: t("shipping.pack.defaultLabel", "기본 라벨") },
    ...templates.map((tpl) => ({
      value: tpl.templateKey,
      label: `${tpl.templateName}${tpl.printMode ? ` / ${tpl.printMode}` : ""}`,
    })),
  ], [templates, t]);

  const serials = useMemo(() => parseSerials(box?.serialList ?? null), [box?.serialList]);
  const printedDate = useMemo(() => {
    const src = box?.closeAt ?? box?.createdAt;
    return src ? String(src).replace("T", " ").slice(0, 16) : new Date().toISOString().slice(0, 16).replace("T", " ");
  }, [box?.closeAt, box?.createdAt]);

  const labelData = useMemo(() => {
    if (!box) return {};
    return {
      boxNo: box.boxNo,
      itemCode: box.itemCode,
      itemName: box.itemName ?? "",
      qty: String(box.qty),
      boxQty: String(box.boxQty ?? ""),
      serialList: box.serialList ?? "",
      closeAt: box.closeAt ?? "",
      createdAt: box.createdAt,
    };
  }, [box]);

  // 자동 출력: 박스가 준비되면 1회 인쇄 (포장단위 도달 자동출력)
  const printedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !autoPrint || !box?.boxNo) return;
    if (printedRef.current === box.boxNo) return;
    printedRef.current = box.boxNo;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoPrint, box?.boxNo]);

  // 모달 닫히면 자동출력 가드 초기화
  useEffect(() => {
    if (!isOpen) printedRef.current = null;
  }, [isOpen]);

  const isUsingDefault = selectedTemplateKey === DEFAULT_TEMPLATE_KEY;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("shipping.pack.boxLabel", "박스 라벨")} size="lg">
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <div className="w-60">
          <Select options={templateOptions} value={selectedTemplateKey} onChange={handleTemplateChange} fullWidth />
        </div>
        <Button onClick={() => window.print()} disabled={!box}>
          <Printer className="w-4 h-4 mr-1" />{t("shipping.pack.reprintLabel", "라벨 재발행")}
        </Button>
      </div>

      {box && (
        <>
          {isUsingDefault ? (
            <div id="box-label-print-area" className="mx-auto w-full max-w-[420px] bg-white text-black border-2 border-black p-4">
              <div className="text-center border-b-2 border-black pb-2 mb-3">
                <div className="text-lg font-extrabold tracking-widest">{t("shipping.pack.boxLabel", "박스 라벨")}</div>
              </div>

              <div className="flex flex-col items-center mb-3">
                <BoxBarcode value={box.boxNo} />
              </div>

              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[96px]">{t("shipping.pack.boxNo", "박스번호")}</th>
                    <td className="border border-black px-2 py-1 font-mono font-bold" colSpan={3}>{box.boxNo}</td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partCode", "품목코드")}</th>
                    <td className="border border-black px-2 py-1 font-mono">{box.itemCode}</td>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[64px]">{t("shipping.pack.packedQty", "포장수량")}</th>
                    <td className="border border-black px-2 py-1 text-right font-bold">
                      {(box.qty ?? 0).toLocaleString()}{box.boxQty ? ` / ${box.boxQty.toLocaleString()}` : ""}
                    </td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partName", "품목명")}</th>
                    <td className="border border-black px-2 py-1" colSpan={3}>{box.itemName ?? "-"}</td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("shipping.pack.packedDate", "포장일시")}</th>
                    <td className="border border-black px-2 py-1" colSpan={3}>{printedDate}</td>
                  </tr>
                </tbody>
              </table>

              {serials.length > 0 && (
                <div className="mt-3">
                  <div className="text-[12px] font-bold mb-1">■ {t("shipping.pack.serialList", "구성 시리얼")} ({serials.length})</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono">
                    {serials.map((s, i) => (
                      <div key={s} className="truncate">{i + 1}. {s}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div id="box-label-print-area" className="mx-auto" style={{ width: `${labelDesign.labelWidth}mm` }}>
              <LabelDesignRenderer design={labelDesign} data={labelData} unit="mm" />
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #box-label-print-area, #box-label-print-area * { visibility: visible; }
          #box-label-print-area { position: absolute; top: 0; left: 0; width: 100%; border: none; }
          @page { size: 100mm 120mm; margin: 6mm; }
        }
      `}</style>

      <div className="flex justify-end pt-4 mt-4 border-t border-border print:hidden">
        <Button variant="secondary" onClick={onClose}>{t("common.close", "닫기")}</Button>
      </div>
    </Modal>
  );
}
