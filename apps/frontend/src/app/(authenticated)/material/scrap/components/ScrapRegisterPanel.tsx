"use client";

/**
 * @file material/scrap/components/ScrapRegisterPanel.tsx
 * @description 우측 폐기 등록 패널
 *
 * 흐름:
 *   1. SCRAP 창고 선택
 *   2. LOT 바코드 스캔 → GET /inventory/stocks?warehouseCode=X&matUid=Y 조회
 *   3. 수량 + 사유 입력
 *   4. [폐기등록] → POST /inventory/scrap → 세션 이력 추가
 *
 * 레이아웃:
 *   상단(고정): 창고 선택 + 스캔 입력 + 결과 + 수량/사유 + 등록 버튼
 *   하단(스크롤): 금일 세션 내 등록 이력
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle, Trash2, XCircle } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { BarcodeScanInput, ComCodeSelect, QtyInput } from "@/components/shared";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface ScrapRegisterPanelProps {
  onCreated: () => void;
}

interface ScannedStock {
  itemCode: string;
  itemName: string;
  matUid: string;
  availableQty: number;
}

interface SessionHistory {
  matUid: string;
  itemName: string;
  qty: number;
  reason: string;
  registeredAt: string;
}

const STORAGE_KEY = "scrap.panel.warehouseCode";

export default function ScrapRegisterPanel({ onCreated }: ScrapRegisterPanelProps) {
  const { t } = useTranslation();

  const { options: warehouseRaw } = useWarehouseOptions("SCRAP");
  const warehouseOptions = [{ value: "", label: t("common.select") }, ...warehouseRaw];

  const [warehouseCode, setWarehouseCode] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? "",
  );
  const [scanInput, setScanInput] = useState("");
  const [scannedStock, setScannedStock] = useState<ScannedStock | null>(null);
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SessionHistory[]>([]);

  const resetScan = useCallback(() => {
    setScannedStock(null);
    setScanInput("");
    setQty(0);
    setReason("");
    setError("");
  }, []);

  // 창고 옵션 로드 완료 후: 저장된 값이 유효하면 유지, 아니면 첫 번째 창고 자동 선택
  useEffect(() => {
    if (warehouseRaw.length === 0) return;
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    const valid = warehouseRaw.some((o) => o.value === saved);
    if (!valid) {
      const first = warehouseRaw[0].value;
      setWarehouseCode(first);
      localStorage.setItem(STORAGE_KEY, first);
    }
  }, [warehouseRaw]);

  const handleWarehouseChange = useCallback((v: string) => {
    setWarehouseCode(v);
    localStorage.setItem(STORAGE_KEY, v);
    resetScan();
  }, [resetScan]);

  /** LOT 바코드 스캔 → SCRAP 창고 내 해당 재고 조회 */
  const handleScan = useCallback(async (rawValue?: string) => {
    const matUid = (rawValue ?? scanInput).replace(/\r?\n|\r/g, "").trim();
    if (!matUid) return;
    if (!warehouseCode) {
      setError(t("material.scrap.selectWarehouseFirst", "먼저 폐기창고를 선택해 주세요."));
      return;
    }
    setScanning(true);
    setError("");
    try {
      const res = await api.get("/inventory/stocks", {
        params: { warehouseCode, matUid },
      });
      const list = res.data?.data ?? res.data ?? [];
      const item = Array.isArray(list) ? list[0] : null;
      if (!item || (item.availableQty ?? 0) <= 0) {
        setError(
          t("material.scrap.notFound", "해당 창고에서 LOT를 찾을 수 없거나 가용수량이 없습니다: {{matUid}}", { matUid })
        );
        setScanInput("");
        return;
      }
      setScannedStock({
        itemCode: item.itemCode ?? "",
        itemName: item.itemName ?? "",
        matUid: item.matUid ?? matUid,
        availableQty: item.availableQty ?? 0,
      });
      setQty(item.availableQty);
      setScanInput("");
    } catch {
      setError(t("material.scrap.scanError", "재고 조회에 실패했습니다."));
      setScanInput("");
    } finally {
      setScanning(false);
    }
  }, [scanInput, warehouseCode, t]);

  /** 폐기 등록 */
  const handleSubmit = useCallback(async () => {
    if (!scannedStock || qty <= 0 || !reason || !warehouseCode) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/inventory/scrap", {
        warehouseCode,
        itemCode: scannedStock.itemCode,
        matUid: scannedStock.matUid || undefined,
        qty,
        transType: "SCRAP",
        remark: reason,
      });
      setHistory((prev) => [
        {
          matUid: scannedStock.matUid,
          itemName: scannedStock.itemName,
          qty,
          reason,
          registeredAt: new Date().toISOString(),
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
  }, [scannedStock, qty, reason, warehouseCode, onCreated, resetScan]);

  const canSubmit = !!scannedStock && qty > 0 && qty <= (scannedStock.availableQty) && !!reason && !saving;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 상단 고정 영역 */}
      <div className="flex-shrink-0 p-3 border-b border-border space-y-2.5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
            <Trash2 className="w-4 h-4 text-primary" />
            {t("material.scrap.register")}
          </h2>
          <Button
            size="sm"
            variant="danger"
            onClick={handleSubmit}
            disabled={!canSubmit}
            isLoading={saving}
          >
            {t("material.scrap.register")}
          </Button>
        </div>

        {/* 창고 선택 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted whitespace-nowrap w-14 flex-shrink-0">
            {t("material.scrap.warehouse")}
          </span>
          <Select
            options={warehouseOptions}
            value={warehouseCode}
            onChange={handleWarehouseChange}
            fullWidth
          />
        </div>

        {/* LOT 스캔 입력 */}
        <div className="space-y-1">
          <p className="text-xs text-text-muted">
            {t("material.scrap.scanHint", "폐기창고에 있는 LOT 바코드를 스캔하세요.")}
          </p>
          <div className="flex gap-1.5">
            <div className="flex-1 min-w-0">
              <BarcodeScanInput
                value={scanInput}
                onChange={setScanInput}
                onScan={handleScan}
                placeholder={t("material.col.matUid", "LOT 번호")}
                disabled={!warehouseCode || !!scannedStock}
                maintainFocus
                className="h-9 text-sm"
                fullWidth
              />
            </div>
            <Button
              size="sm"
              onClick={() => handleScan()}
              disabled={!scanInput.trim() || scanning || !!scannedStock}
              className="h-9 flex-shrink-0"
            >
              {scanning ? "…" : t("common.search")}
            </Button>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 스캔 결과 + 수량/사유 */}
        {scannedStock && (
          <div className="border border-border rounded-md p-2.5 bg-surface space-y-2.5">
            {/* lot 정보 */}
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
                <span className="text-text-muted">{t("common.partCode")}</span>
                <p className="font-mono font-medium text-text truncate">{scannedStock.itemCode}</p>
              </div>
              <div>
                <span className="text-text-muted">LOT</span>
                <p className="font-bold text-primary truncate">{scannedStock.matUid}</p>
              </div>
              <div className="col-span-2">
                <span className="text-text-muted">{t("common.partName")}</span>
                <p className="font-medium text-text truncate">{scannedStock.itemName}</p>
              </div>
              <div>
                <span className="text-text-muted">{t("material.scrap.availableQty")}</span>
                <p className="font-semibold text-blue-600 dark:text-blue-400">
                  {scannedStock.availableQty.toLocaleString()}
                </p>
              </div>
            </div>

            {/* 수량 + 사유 */}
            <div className="space-y-2 pt-1 border-t border-border">
              <QtyInput
                label={`${t("material.scrap.qty")} (최대 ${scannedStock.availableQty.toLocaleString()})`}
                value={qty}
                onChange={setQty}
                maxValue={scannedStock.availableQty}
                fullWidth
              />
              <ComCodeSelect
                groupCode="SCRAP_REASON"
                includeAll={false}
                label={t("material.scrap.reason")}
                value={reason}
                onChange={setReason}
                fullWidth
              />
            </div>
          </div>
        )}
      </div>

      {/* 하단 스크롤: 세션 내 등록 이력 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-1.5 border-b border-border bg-muted/50 sticky top-0">
          <span className="text-xs font-semibold text-text-muted">
            {t("material.scrap.sessionHistory", "금일 등록 이력")}
            {history.length > 0 && (
              <span className="ml-1 text-primary">({history.length})</span>
            )}
          </span>
        </div>
        {history.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">
            {t("material.scrap.noHistory", "등록 이력 없음")}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted dark:bg-slate-800 sticky top-8 z-10 text-left text-text-muted">
              <tr>
                <th className="px-2.5 py-1.5">{t("material.issue.scanTime", "시간")}</th>
                <th className="px-2.5 py-1.5">{t("common.partName")}</th>
                <th className="px-2.5 py-1.5 text-right">{t("material.scrap.qty")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/50">
                  <td className="px-2.5 py-1.5 text-text-muted whitespace-nowrap">
                    {new Date(h.registeredAt).toLocaleTimeString(undefined, {
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                  <td className="px-2.5 py-1.5 truncate" style={{ maxWidth: 100 }}>
                    {h.itemName}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                    -{h.qty.toLocaleString()}
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
