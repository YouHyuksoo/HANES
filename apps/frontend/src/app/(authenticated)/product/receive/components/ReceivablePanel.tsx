"use client";

/**
 * @file components/ReceivablePanel.tsx
 * @description 우측 입고 작업 패널 - 상단 고정 스캔영역 + 입고 가능 박스 목록
 *
 * 초보자 가이드:
 * 1. 상단(고정): 박스 스캔 입력 + 입고창고 선택 + 선택입고 버튼
 * 2. 본문: 입고 가능 박스(box-stock의 PACKED_WAITING=포장완료·미입고) 목록
 * 3. 스캔하거나 행을 클릭하면 선택 누적 → 창고 지정 후 일괄 입고
 * 4. 입고 대상 = FG_LABELS.BOX_NO 부여(포장)됐지만 아직 창고입고 거래가 없는 박스
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScanLine, RefreshCw, PackageCheck, AlertTriangle, CheckSquare, Square } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { Button, Select } from "@/components/ui";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import { receiveBoxes, type ReceiveCandidate } from "./useBoxReceive";

interface ReceivablePanelProps {
  /** 입고 성공 시 좌측 입고이력 새로고침 */
  onReceived: () => void;
}

/** GET /shipping/box-stock 응답 행 */
interface BoxStockRow {
  boxNo: string;
  itemCode: string;
  itemName: string | null;
  qty: number;
  orderNo: string | null;
  inventoryState: string; // PACKED_WAITING | WAREHOUSE_RECEIVED
}

export default function ReceivablePanel({ onReceived }: ReceivablePanelProps) {
  const { t } = useTranslation();
  const { options: whOptions } = useWarehouseOptions("FG");

  const [rows, setRows] = useState<BoxStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [boxNo, setBoxNo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<{ boxNo: string; reason: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 입고 가능 박스 조회 (포장완료·미입고) */
  const fetchReceivable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/shipping/box-stock");
      const body = (res.data?.data ?? res.data) as BoxStockRow[] | undefined;
      const list = Array.isArray(body) ? body : [];
      setRows(list.filter((r) => r.inventoryState === "PACKED_WAITING"));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceivable();
  }, [fetchReceivable]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  /** 박스번호 스캔 → 목록에 있으면 선택, 없으면 사유 안내 */
  const handleScan = useCallback(async (rawCode?: string) => {
    const code = (rawCode ?? boxNo).replace(/\r?\n|\r/g, "").trim();
    if (!code) return;
    const found = rows.find((r) => r.boxNo === code);
    if (found) {
      setSelected((prev) => new Set(prev).add(code));
      setError("");
      setBoxNo("");
    } else {
      try {
        const res = await api.get(`/shipping/boxes/box-no/${encodeURIComponent(code)}`);
        const box = res.data?.data;
        setError(
          box
            ? t("productMgmt.receive.panel.notReceivable")
            : t("productMgmt.receive.panel.notFound", { boxNo: code }),
        );
      } catch {
        setError(t("productMgmt.receive.panel.notFound", { boxNo: code }));
      }
      setBoxNo("");
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [boxNo, rows, t]);

  const toggleOne = useCallback((code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.boxNo));
  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.boxNo)));
  }, [allSelected, rows]);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.boxNo)), [rows, selected]);
  const totalQty = selectedRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const handleReceive = useCallback(async () => {
    if (!warehouseId || selectedRows.length === 0) return;
    setSaving(true);
    setFailed([]);
    try {
      const candidates: ReceiveCandidate[] = selectedRows.map((r) => ({
        boxNo: r.boxNo,
        itemCode: r.itemCode,
        itemName: r.itemName,
        itemType: "FINISHED",
        qty: Number(r.qty) || 0,
        status: "CLOSED",
      }));
      const result = await receiveBoxes(candidates, warehouseId);
      setFailed(result.failed);
      // 실패분만 선택 유지
      setSelected(new Set(result.failed.map((f) => f.boxNo)));
      onReceived();
      await fetchReceivable();
    } finally {
      setSaving(false);
    }
  }, [warehouseId, selectedRows, onReceived, fetchReceivable]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 상단 고정 스캔 영역 */}
      <div className="flex-shrink-0 p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
            <ScanLine className="w-4 h-4 text-primary" />
            {t("productMgmt.receive.panel.scanTitle")}
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchReceivable}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <BarcodeScanInput
          ref={inputRef}
          value={boxNo}
          onChange={setBoxNo}
          onScan={handleScan}
          placeholder={t("productMgmt.receive.boxScan.placeholder")}
          fullWidth
          maintainFocus
        />

        <Select
          label={t("productMgmt.receive.modal.warehouseId")}
          options={whOptions}
          value={warehouseId}
          onChange={setWarehouseId}
          fullWidth
        />

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-text-muted">
            {t("productMgmt.receive.boxList.selectedTotal", { count: selectedRows.length })}{" "}
            <span className="text-primary font-medium">{totalQty.toLocaleString()}</span>
          </span>
          <Button
            onClick={handleReceive}
            disabled={saving || selectedRows.length === 0 || !warehouseId}
          >
            <PackageCheck className="w-4 h-4 mr-1" />
            {saving
              ? t("common.saving")
              : t("productMgmt.receive.boxList.receiveSelected", { count: selectedRows.length })}
          </Button>
        </div>

        {failed.length > 0 && (
          <div className="p-3 rounded-md border border-red-300 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle className="w-4 h-4" />
              {t("productMgmt.receive.boxList.partialFail", { count: failed.length })}
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {failed.map((f) => (
                <li key={f.boxNo}>
                  <span className="font-mono">{f.boxNo}</span> — {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 입고 가능 박스 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted dark:bg-slate-800 sticky top-0 z-10">
            <tr className="text-left text-text-muted">
              <th className="w-10 px-3 py-2">
                <button onClick={toggleAll} className="flex items-center" aria-label="select-all">
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2">{t("productMgmt.receive.panel.colBox")}</th>
              <th className="px-3 py-2">{t("common.partName")}</th>
              <th className="px-3 py-2 text-right">{t("common.quantity")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-12 text-center text-text-muted">
                  {loading ? t("common.loading") : t("productMgmt.receive.panel.receivableEmpty")}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const checked = selected.has(r.boxNo);
                return (
                  <tr
                    key={r.boxNo}
                    onClick={() => toggleOne(r.boxNo)}
                    className={`border-t border-border cursor-pointer hover:bg-muted/50 ${
                      checked ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-text-muted" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.boxNo}</td>
                    <td className="px-3 py-2">{r.itemName ?? r.itemCode}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {(Number(r.qty) || 0).toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
