"use client";

/**
 * @file components/InputSgScanPanel.tsx
 * @description 서브공정 키팅 — 이전 공정 SFG 라벨 스캔 패널.
 *   키오스크 공정에서 부착되어 온 SFG 라벨을 스캔해 누적하고, BOM(반제품 자식) 오투입을 차단한다.
 *   input-assembly의 SgScanPanel 거울상(완제품 FG가 아니라 반제품 서브를 만든다).
 */
import type { JSX } from "react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Scan, Trash2 } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { useCarrierAutoInput } from "@/components/shared/carrier";
import api from "@/services/api";

interface SgLabelInfo {
  sgBarcode: string;
  itemCode: string;
  remainQty: number;
  status: string;
  orderNo?: string | null;
}

interface AssemblyComponent {
  itemCode: string;
  itemName: string;
  itemType: string;
  qtyPer: number;
  totalRequired: number;
}

export default function InputSgScanPanel({
  orderNo,
  sgList,
  components,
  onAdd,
  onRemove,
  equipCode,
  carrierAutoInputYn,
}: {
  orderNo: string | undefined;
  sgList: SgLabelInfo[];
  components: AssemblyComponent[];
  onAdd: (data: SgLabelInfo) => void;
  onRemove: (sgBarcode: string) => void;
  equipCode: string;
  carrierAutoInputYn: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  const [scanInput, setScanInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  /** 대차 스캔은 handleScan 하나가 N번 네트워크 왕복을 한다 — 그동안 재진입 스캔이
   *  같은 sgList 스냅샷으로 addOne을 또 돌려 중복 추가되는 것을 막는다. */
  const scanning = useRef(false);

  /** SFG 라벨 하나 검증 후 추가 — 낱개 스캔과 대차 자동투입이 같은 함수를 쓴다. */
  const addOne = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!orderNo) {
        toast.error(t("production.subprocess.requireOrderNo", "작업지시를 선택하세요."));
        return false;
      }

      if (sgList.some((item) => item.sgBarcode === barcode)) {
        toast.error(t("production.subprocess.scanDuplicate", "이미 스캔된 라벨입니다."));
        return false;
      }

      if (/^FG\d/i.test(barcode)) {
        toast.error(
          t("production.subprocess.scanIsFgLabel", "완제품(FG) 바코드입니다. 이전 공정 반제품(SFG) 라벨을 스캔하세요."),
        );
        return false;
      }

      setLoading(true);
      try {
        const res = await api.get(
          `/production/subprocess-kitting/sg-label/${encodeURIComponent(barcode)}`,
        );
        const data = res.data?.data as SgLabelInfo;

        if (data.remainQty <= 0) {
          toast.error(t("production.kitting.warnZeroQty", "잔량이 없는 SFG 라벨입니다."));
          return false;
        }

        const validStatuses = ["IN_STOCK", "MOUNTED"];
        if (!validStatuses.includes(data.status?.toUpperCase())) {
          toast.error(
            `${t("production.kitting.warnInvalidStatus", "사용할 수 없는 SFG 라벨 상태입니다.")} (${data.status})`,
          );
          return false;
        }

        if (
          components.length > 0 &&
          !components.some((comp) => comp.itemCode === data.itemCode)
        ) {
          toast.error(
            t("production.subprocess.scanNotInBom", "BOM에 없는 반제품입니다 (오투입)"),
          );
          return false;
        }

        onAdd(data);
        return true;
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("production.subprocess.scanNotFound", "SFG 라벨을 찾을 수 없습니다.");
        toast.error(message);
        return false;
      } finally {
        setLoading(false);
        scanRef.current?.focus();
      }
    },
    [components, onAdd, orderNo, sgList, t],
  );

  const carrierAuto = useCarrierAutoInput({ equipCode, enabled: carrierAutoInputYn, handleBarcode: addOne });

  const handleScan = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || scanning.current) return;

      scanning.current = true;
      try {
        const { handled } = await carrierAuto.run(trimmed);
        if (handled) {
          setScanInput("");
          return;
        }

        await addOne(trimmed);
        setScanInput("");
      } finally {
        scanning.current = false;
      }
    },
    [addOne, carrierAuto],
  );

  return (
    <div className="flex flex-col h-full min-h-0 border border-border rounded">
      <div className="p-4 flex-shrink-0 border-b border-border">
        <h2 className="font-bold text-text mb-3 flex items-center gap-2">
          <Scan className="w-5 h-5 text-primary" />
          {t("production.subprocess.inputScanSection", "이전 공정 SFG 스캔")}
        </h2>
        <BarcodeScanInput
          ref={scanRef}
          value={scanInput}
          onChange={setScanInput}
          onScan={handleScan}
          placeholder={t("production.subprocess.inputScanPlaceholder", "이전 공정 SFG 바코드 스캔 또는 입력 후 Enter")}
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
                    <td className="px-3 py-2 font-mono text-xs">{item.sgBarcode}</td>
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
