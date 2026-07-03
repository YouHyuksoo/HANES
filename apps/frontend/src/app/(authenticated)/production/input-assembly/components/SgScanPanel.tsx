"use client";

import type { JSX } from "react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Scan, Trash2 } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import api from "@/services/api";

interface SgLabelInfo {
  sgBarcode: string;
  itemCode: string;
  remainQty: number;
  status: string;
  orderNo?: string | null;
  /** 라벨 종류 — BUNDLE(묶음)/SFG(회로) */
  labelType?: string;
}

interface AssemblyComponent {
  itemCode: string;
  itemName: string;
  itemType: string;
  qtyPer: number;
  totalRequired: number;
}

export default function SgScanPanel({
  orderNo,
  sgList,
  components,
  onAdd,
  onRemove,
}: {
  orderNo: string | undefined;
  sgList: SgLabelInfo[];
  components: AssemblyComponent[];
  onAdd: (data: SgLabelInfo) => void;
  onRemove: (sgBarcode: string) => void;
}): JSX.Element {
  const { t } = useTranslation();

  const [scanInput, setScanInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);

  const handleScan = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      if (!orderNo) {
        toast.error(t("production.inputAssembly.requireOrder", "작업지시를 선택하세요."));
        setScanInput("");
        return;
      }

      if (sgList.some((item) => item.sgBarcode === trimmed)) {
        toast.error(t("production.inputAssembly.scanDuplicate", "이미 스캔된 라벨입니다."));
        setScanInput("");
        return;
      }

      if (/^FG\d/i.test(trimmed)) {
        toast.error(
          t("production.inputAssembly.scanIsFgLabel", "완제품(FG) 바코드입니다. 반제품(SFG) 라벨을 스캔하세요."),
        );
        setScanInput("");
        return;
      }

      setLoading(true);
      try {
        const res = await api.get(
          `/production/subprocess-kitting/sg-label/${encodeURIComponent(trimmed)}`,
        );
        const data = res.data?.data as SgLabelInfo;

        if (data.remainQty <= 0) {
          toast.error(t("production.kitting.warnZeroQty", "잔량이 없는 SFG 라벨입니다."));
          setScanInput("");
          return;
        }

        const validStatuses = ["IN_STOCK", "MOUNTED"];
        if (!validStatuses.includes(data.status?.toUpperCase())) {
          toast.error(
            `${t("production.kitting.warnInvalidStatus", "사용할 수 없는 SFG 라벨 상태입니다.")} (${data.status})`,
          );
          setScanInput("");
          return;
        }

        if (
          components.length > 0 &&
          !components.some((comp) => comp.itemCode === data.itemCode)
        ) {
          toast.error(
            t("production.inputAssembly.scanNotInBom", "BOM에 없는 반제품입니다 (오투입)"),
          );
          setScanInput("");
          return;
        }

        onAdd(data);
        setScanInput("");
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.inputAssembly.scanNotFound", "SFG 라벨을 찾을 수 없습니다.");
        toast.error(message);
        setScanInput("");
      } finally {
        setLoading(false);
        scanRef.current?.focus();
      }
    },
    [components, onAdd, orderNo, sgList, t],
  );

  return (
    <div className="flex flex-col h-full min-h-0 border border-border rounded">
      <div className="p-4 flex-shrink-0 border-b border-border">
        <h2 className="font-bold text-text mb-3 flex items-center gap-2">
          <Scan className="w-5 h-5 text-primary" />
          {t("production.inputAssembly.scanSection", "반제품 스캔 (세트·리셋)")}
        </h2>
        <BarcodeScanInput
          ref={scanRef}
          value={scanInput}
          onChange={setScanInput}
          onScan={handleScan}
          placeholder={t("production.inputAssembly.scanPlaceholder", "SFG 바코드 스캔 또는 입력 후 Enter")}
          disabled={!orderNo || loading}
          fullWidth
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {sgList.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6 border border-dashed border-border rounded">
            {t("common.noData")}
          </p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr className="text-text-muted text-xs">
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("production.kitting.sgBarcode", "SFG 바코드")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("common.itemCode", "품번")}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">
                    {t("production.kitting.sgRemainQty", "잔량")}
                  </th>
                  <th className="px-3 py-2 text-center font-semibold">
                    {t("common.status", "상태")}
                  </th>
                  <th className="px-3 py-2 text-center font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {sgList.map((item, index) => (
                  <tr
                    key={item.sgBarcode}
                    className="border-b border-border/70 hover:bg-surface/60"
                  >
                    <td className="px-3 py-2 text-text-muted text-xs">{index + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {item.sgBarcode}
                      {item.labelType && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] border border-border text-text-muted align-middle">
                          {item.labelType === "BUNDLE"
                            ? t("sgLabel.typeBundle", "묶음")
                            : t("sgLabel.typeCircuit", "회로")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{item.itemCode}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
                      {item.remainQty != null ? item.remainQty.toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded text-xs border border-border text-text-muted">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-red-500/10 text-red-500"
                        onClick={() => onRemove(item.sgBarcode)}
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
