"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { BarcodeScanInput, QtyInput, WarehouseSelect } from "@/components/shared";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface StockTransferPanelProps {
  onCreated: () => void;
}

interface ScannedStock {
  itemCode: string;
  itemName: string;
  matUid: string;
  warehouseCode: string;
  warehouseName: string;
  availableQty: number;
}

interface SessionHistory {
  matUid: string;
  itemName: string;
  qty: number;
  fromWarehouseName: string;
  toWarehouseName: string;
  transferredAt: string;
}

export default function StockTransferPanel({ onCreated }: StockTransferPanelProps) {
  const { t } = useTranslation();
  const { options: warehouseRaw } = useWarehouseOptions();

  const [toWarehouseCode, setToWarehouseCode] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [scannedStock, setScannedStock] = useState<ScannedStock | null>(null);
  const [qty, setQty] = useState(0);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SessionHistory[]>([]);

  const resetScan = useCallback(() => {
    setScannedStock(null);
    setScanInput("");
    setQty(0);
    setError("");
  }, []);

  const handleToWarehouseChange = useCallback((v: string) => {
    setToWarehouseCode(v);
    setError("");
    resetScan();
  }, [resetScan]);

  const handleScan = useCallback(async (rawValue?: string) => {
    const matUid = (rawValue ?? scanInput).replace(/\r?\n|\r/g, "").trim();
    if (!matUid) return;
    if (!toWarehouseCode) {
      setError("목적창고를 먼저 선택하세요.");
      return;
    }
    setScanning(true);
    setError("");
    try {
      const res = await api.get("/inventory/stocks", { params: { matUid } });
      const list = res.data?.data ?? res.data ?? [];
      const item = Array.isArray(list) ? list[0] : null;
      if (!item || (item.availableQty ?? 0) <= 0) {
        setError(t("material.transfer.notFound", { matUid }));
        setScanInput("");
        return;
      }
      if ((item.warehouseId ?? "") === toWarehouseCode) {
        setError(t("material.transfer.sameWarehouseError"));
        setScanInput("");
        return;
      }
      setScannedStock({
        itemCode: item.itemCode ?? "",
        itemName: item.itemName ?? "",
        matUid: item.matUid ?? matUid,
        warehouseCode: item.warehouseId ?? "",
        warehouseName: item.warehouseName ?? item.warehouseId ?? "",
        availableQty: item.availableQty ?? 0,
      });
      setQty(item.availableQty);
      setScanInput("");
    } catch {
      setError(t("material.transfer.scanError"));
      setScanInput("");
    } finally {
      setScanning(false);
    }
  }, [scanInput, toWarehouseCode, t]);

  const handleSubmit = useCallback(async () => {
    if (!scannedStock || !toWarehouseCode || qty <= 0) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/inventory/transfer", {
        fromWarehouseCode: scannedStock.warehouseCode,
        toWarehouseCode,
        itemCode: scannedStock.itemCode,
        matUid: scannedStock.matUid || undefined,
        qty,
      });
      const toWarehouse = warehouseRaw.find((o) => o.value === toWarehouseCode);
      setHistory((prev) => [
        {
          matUid: scannedStock.matUid,
          itemName: scannedStock.itemName,
          qty,
          fromWarehouseName: scannedStock.warehouseName,
          toWarehouseName: toWarehouse?.label ?? toWarehouseCode,
          transferredAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      onCreated();
      resetScan();
    } catch {
      // API 인터셉터에서 상세 메시지 표시
    } finally {
      setSaving(false);
    }
  }, [scannedStock, toWarehouseCode, qty, warehouseRaw, onCreated, resetScan]);

  const canSubmit = !!scannedStock && !!toWarehouseCode && qty > 0 && qty <= scannedStock.availableQty && !saving;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-3 border-b border-border space-y-3">

        {/* ① 목적창고 — 항상 표시 */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-muted">목적창고</p>
          <WarehouseSelect
            value={toWarehouseCode}
            onChange={handleToWarehouseChange}
            fullWidth
          />
        </div>

        {/* ② LOT 스캔 */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-muted">자재 LOT 스캔</p>
          <BarcodeScanInput
            value={scanInput}
            onChange={setScanInput}
            onScan={handleScan}
            placeholder="LOT 번호 스캔 또는 입력 후 Enter"
            disabled={!!scannedStock || scanning}
            maintainFocus
            fullWidth
          />
        </div>

        {/* 에러 */}
        {error && (
          <div className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ③ 스캔 결과 + 수량 + 이동 버튼 */}
        {scannedStock && (
          <div className="border border-border rounded-md p-2.5 bg-surface space-y-2.5">
            <div className="flex items-start justify-between gap-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-text">LOT 확인</span>
              </div>
              <button type="button" onClick={resetScan} className="text-text-muted hover:text-text">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>
                <p className="text-text-muted">{t("common.partCode")}</p>
                <p className="font-mono font-medium text-text truncate">{scannedStock.itemCode}</p>
              </div>
              <div>
                <p className="text-text-muted">LOT</p>
                <p className="font-bold text-primary truncate">{scannedStock.matUid}</p>
              </div>
              <div className="col-span-2">
                <p className="text-text-muted">{t("common.partName")}</p>
                <p className="font-medium text-text truncate">{scannedStock.itemName}</p>
              </div>
              <div>
                <p className="text-text-muted">출발창고</p>
                <p className="font-medium text-text truncate">{scannedStock.warehouseName}</p>
              </div>
              <div>
                <p className="text-text-muted">가용수량</p>
                <p className="font-semibold text-blue-600 dark:text-blue-400">
                  {scannedStock.availableQty.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="pt-1 border-t border-border space-y-2">
              <QtyInput
                label={`이동수량 (최대 ${scannedStock.availableQty.toLocaleString()})`}
                value={qty}
                onChange={setQty}
                maxValue={scannedStock.availableQty}
                fullWidth
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit}
                isLoading={saving}
                className="w-full"
              >
                이동
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 금일 이동 이력 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-1.5 border-b border-border bg-muted/50 sticky top-0">
          <span className="text-xs font-semibold text-text-muted">
            금일 이동 이력
            {history.length > 0 && <span className="ml-1 text-primary">({history.length})</span>}
          </span>
        </div>
        {history.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">이동 이력 없음</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted dark:bg-slate-800 sticky top-8 z-10 text-left text-text-muted">
              <tr>
                <th className="px-2.5 py-1.5">시간</th>
                <th className="px-2.5 py-1.5">품목명</th>
                <th className="px-2.5 py-1.5">목적창고</th>
                <th className="px-2.5 py-1.5 text-right">수량</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/50">
                  <td className="px-2.5 py-1.5 text-text-muted whitespace-nowrap">
                    {new Date(h.transferredAt).toLocaleTimeString(undefined, {
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                  <td className="px-2.5 py-1.5 truncate" style={{ maxWidth: 80 }}>
                    {h.itemName}
                  </td>
                  <td className="px-2.5 py-1.5 truncate text-text-muted" style={{ maxWidth: 80 }}>
                    {h.toWarehouseName}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {h.qty.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
