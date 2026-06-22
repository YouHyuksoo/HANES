"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { Modal, Button, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { LabelDesign, createDefaultLabelDesign, ensureObjectLabelDesign } from "@/app/(authenticated)/master/label/types";
import { LabelDesignRenderer } from "@/app/(authenticated)/master/label/components/LabelDesignRenderer";
import api from "@/services/api";

interface TemplateInfo {
  templateKey: string;
  templateName: string;
  category: string;
  printMode: string;
  designData: LabelDesign;
  isDefault?: boolean;
}

export interface PalletLabelInfo {
  palletNo: string;
  boxCount: number;
  totalQty: number;
  status: string;
  shipOrderNo?: string | null;
  itemCode?: string;
  itemName?: string;
  boxes?: Array<{ boxNo: string; itemCode: string; qty: number }>;
  createdAt: string;
}

interface Props {
  isOpen: boolean;
  pallet: PalletLabelInfo | null;
  autoPrint?: boolean;
  onClose: () => void;
}

const DEFAULT_TEMPLATE_KEY = "__default__";

function PalletBarcode({ value }: { value: string }) {
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
        /* 바코드 실패해도 텍스트는 표시됨 */
      }
    })();
    return () => { cancelled = true; };
  }, [value]);
  return <canvas ref={canvasRef} className="max-w-full" />;
}

export default function PalletLabelModal({ isOpen, pallet, autoPrint = false, onClose }: Props) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(DEFAULT_TEMPLATE_KEY);
  const [labelDesign, setLabelDesign] = useState<LabelDesign>(() => createDefaultLabelDesign("pallet"));

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await api.get("/master/label-templates", { params: { category: "pallet" } });
        const rawTemplates = res.data?.data ?? [];
        const nextTemplates = rawTemplates.map((tpl: Record<string, unknown>) => {
          const rawDesign = typeof tpl.designData === "string" ? JSON.parse(tpl.designData as string) : tpl.designData;
          return {
            templateKey: tpl.templateKey ?? `${tpl.templateName}::${tpl.category}`,
            templateName: tpl.templateName,
            category: tpl.category,
            printMode: tpl.printMode ?? "BROWSER",
            designData: ensureObjectLabelDesign(rawDesign, "pallet"),
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
        setLabelDesign(createDefaultLabelDesign("pallet"));
      }
    })();
  }, [isOpen]);

  const handleTemplateChange = useCallback((templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    if (templateKey === DEFAULT_TEMPLATE_KEY) {
      setLabelDesign(createDefaultLabelDesign("pallet"));
      return;
    }
    const tpl = templates.find((item) => item.templateKey === templateKey);
    if (!tpl) return;
    setLabelDesign(ensureObjectLabelDesign(tpl.designData, "pallet"));
  }, [templates]);

  const templateOptions = useMemo<SelectOption[]>(() => [
    { value: DEFAULT_TEMPLATE_KEY, label: t("shipping.pallet.defaultLabel", "기본 라벨") },
    ...templates.map((tpl) => ({
      value: tpl.templateKey,
      label: `${tpl.templateName}${tpl.printMode ? ` / ${tpl.printMode}` : ""}`,
    })),
  ], [templates, t]);

  const labelData = useMemo(() => {
    if (!pallet) return {};
    return {
      palletNo: pallet.palletNo,
      boxCount: String(pallet.boxCount),
      totalQty: String(pallet.totalQty),
      status: pallet.status,
      shipOrderNo: pallet.shipOrderNo ?? "",
      itemCode: pallet.itemCode ?? "",
      itemName: pallet.itemName ?? "",
      createdAt: pallet.createdAt ? String(pallet.createdAt).replace("T", " ").slice(0, 16) : "",
    };
  }, [pallet]);

  const printedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !autoPrint || !pallet?.palletNo) return;
    if (printedRef.current === pallet.palletNo) return;
    printedRef.current = pallet.palletNo;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoPrint, pallet?.palletNo]);

  useEffect(() => {
    if (!isOpen) printedRef.current = null;
  }, [isOpen]);

  const isUsingDefault = selectedTemplateKey === DEFAULT_TEMPLATE_KEY;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("shipping.pallet.palletLabel", "팔레트 라벨")} size="lg">
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <div className="w-60">
          <Select options={templateOptions} value={selectedTemplateKey} onChange={handleTemplateChange} fullWidth />
        </div>
        <Button onClick={() => window.print()} disabled={!pallet}>
          <Printer className="w-4 h-4 mr-1" />{t("shipping.pallet.printLabel", "라벨 출력")}
        </Button>
      </div>

      {pallet && (
        <>
          {isUsingDefault ? (
            <div id="pallet-label-print-area" className="mx-auto w-full max-w-[420px] bg-white text-black border-2 border-black p-4">
              <div className="text-center border-b-2 border-black pb-2 mb-3">
                <div className="text-lg font-extrabold tracking-widest">{t("shipping.pallet.palletLabel", "팔레트 라벨")}</div>
              </div>
              <div className="flex flex-col items-center mb-3">
                <PalletBarcode value={pallet.palletNo} />
              </div>
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  <tr>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[96px]">{t("shipping.pallet.palletNo", "팔레트번호")}</th>
                    <td className="border border-black px-2 py-1 font-mono font-bold" colSpan={3}>{pallet.palletNo}</td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("shipping.pallet.boxCount", "박스수")}</th>
                    <td className="border border-black px-2 py-1 font-bold">{(pallet.boxCount ?? 0).toLocaleString()}</td>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left w-[64px]">{t("common.totalQty", "총수량")}</th>
                    <td className="border border-black px-2 py-1 text-right font-bold">{(pallet.totalQty ?? 0).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.status", "상태")}</th>
                    <td className="border border-black px-2 py-1 font-mono" colSpan={3}>{pallet.status}</td>
                  </tr>
                  {pallet.itemName && (
                    <tr>
                      <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.partName", "대표품목")}</th>
                      <td className="border border-black px-2 py-1" colSpan={3}>{pallet.itemName}</td>
                    </tr>
                  )}
                  <tr>
                    <th className="border border-black bg-gray-100 px-2 py-1 text-left">{t("common.createdAt", "생성일시")}</th>
                    <td className="border border-black px-2 py-1" colSpan={3}>
                      {String(pallet.createdAt).replace("T", " ").slice(0, 16)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {pallet.boxes && pallet.boxes.length > 0 && (
                <div className="mt-3">
                  <div className="text-[12px] font-bold mb-1">■ {t("shipping.pallet.boxList", "구성 박스")} ({pallet.boxes.length})</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono">
                    {pallet.boxes.map((box, i) => (
                      <div key={box.boxNo} className="truncate">{i + 1}. {box.boxNo}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div id="pallet-label-print-area" className="mx-auto" style={{ width: `${labelDesign.labelWidth}mm` }}>
              <LabelDesignRenderer design={labelDesign} data={labelData} unit="mm" />
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #pallet-label-print-area, #pallet-label-print-area * { visibility: visible; }
          #pallet-label-print-area { position: absolute; top: 0; left: 0; width: 100%; border: none; }
          @page { size: 100mm 120mm; margin: 6mm; }
        }
      `}</style>

      <div className="flex justify-end pt-4 mt-4 border-t border-border print:hidden">
        <Button variant="secondary" onClick={onClose}>{t("common.close", "닫기")}</Button>
      </div>
    </Modal>
  );
}
