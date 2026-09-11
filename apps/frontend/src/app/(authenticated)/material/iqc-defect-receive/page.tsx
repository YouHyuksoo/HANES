"use client";

/**
 * @file src/app/(authenticated)/material/iqc-defect-receive/page.tsx
 * @description IQC 불합격자재 불량창고 입고 (요청사항 2026-09-11 06번, 수동입고 방식)
 *
 * 초보자 가이드:
 * 1. 수입검사 FAIL LOT은 입하재고에 그대로 남는다(SYS_CONFIGS IQC_FAIL_DEFECT_MOVE_MODE=MANUAL).
 * 2. 「입고 대기」 탭에서 시리얼/입하번호 바코드를 스캔하거나 체크박스로 골라 불량창고(DEFECT)를 선택해 입고한다.
 * 3. 「이력」 탭은 입고/취소(자동이동 포함) 트랜잭션을 보여주고, 불량창고 재고가 그대로면 취소(입하재고 원복)할 수 있다.
 * 4. API: GET /material/iqc-defect-receive/pending · POST /material/iqc-defect-receive · POST …/cancel · GET …/history
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { ColumnDef } from "@tanstack/react-table";
import { PackageX, RefreshCw, Search, Undo2, Warehouse as WarehouseIcon } from "lucide-react";
import { Button, Card, CardContent, Input, Modal } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import WarehouseSelect from "@/components/shared/WarehouseSelect";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import HelpTooltip from "@/components/shared/HelpTooltip";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";

interface PendingRow {
  matUid: string;
  arrivalNo: string | null;
  arrivalSeq: number | null;
  itemCode: string;
  itemName: string | null;
  unit: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  qty: number;
  fromWarehouseCode: string;
  recvDate: string | null;
  judgedAt: string | null;
  judgeReason: string | null;
  inspectorName: string | null;
}

interface HistoryRow {
  transNo: string;
  transDate: string;
  refType: string;
  matUid: string | null;
  itemCode: string;
  itemName: string | null;
  qty: number;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  workerId: string | null;
  remark: string | null;
  canceledBy: string | null;
  cancelRefId: string | null;
}

type Tab = "pending" | "history";

const fmtDateTime = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
};
const fmtDate = (v?: string | null) => (v ? String(v).slice(0, 10) : "-");

export default function IqcDefectReceivePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("pending");

  // ── 입고 대기 ──
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [scanValue, setScanValue] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [remark, setRemark] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/material/iqc-defect-receive/pending", { params: search ? { search } : undefined });
      const rows: PendingRow[] = res.data?.data ?? [];
      setPending(rows);
      setChecked((prev) => new Set([...prev].filter((uid) => rows.some((r) => r.matUid === uid))));
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [search]);
  useEffect(() => { void fetchPending(); }, [fetchPending]);

  const toggle = useCallback((matUid: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(matUid)) next.delete(matUid); else next.add(matUid);
      return next;
    });
  }, []);
  const allChecked = pending.length > 0 && pending.every((r) => checked.has(r.matUid));
  const toggleAll = useCallback(() => {
    setChecked(allChecked ? new Set() : new Set(pending.map((r) => r.matUid)));
  }, [allChecked, pending]);

  /** 바코드 스캔: 시리얼이면 그 행, 입하번호면 그 입하의 대기 행 전체를 체크 */
  const handleScan = useCallback(async (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;
    try {
      const res = await api.get("/material/iqc-defect-receive/lookup", { params: { barcode: code } });
      const rows: PendingRow[] = res.data?.data ?? [];
      if (rows.length === 0) {
        toast.error(t("material.iqcDefectReceive.scanNotFound", "불량창고 입고 대기 건이 아닙니다: {{barcode}}", { barcode: code }));
        return;
      }
      setPending((prev) => {
        const known = new Set(prev.map((r) => r.matUid));
        const added = rows.filter((r) => !known.has(r.matUid));
        return added.length > 0 ? [...added, ...prev] : prev;
      });
      setChecked((prev) => new Set([...prev, ...rows.map((r) => r.matUid)]));
      toast.success(t("material.iqcDefectReceive.scanAdded", "{{count}}건 선택", { count: rows.length }));
    } catch {
      toast.error(t("material.iqcDefectReceive.scanFailed", "바코드 조회에 실패했습니다."));
    }
  }, [t]);

  const selectedRows = useMemo(() => pending.filter((r) => checked.has(r.matUid)), [pending, checked]);
  const selectedQty = useMemo(() => selectedRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0), [selectedRows]);

  const handleReceive = useCallback(async () => {
    if (selectedRows.length === 0 || !warehouseCode) return;
    setSaving(true);
    try {
      const res = await api.post("/material/iqc-defect-receive", {
        matUids: selectedRows.map((r) => r.matUid),
        warehouseCode,
        remark: remark.trim() || undefined,
      });
      const data = res.data?.data as { done: Array<{ matUid: string }>; failed: Array<{ matUid: string; reason: string }> } | undefined;
      const doneCount = data?.done?.length ?? 0;
      const failed = data?.failed ?? [];
      if (doneCount > 0) toast.success(t("material.iqcDefectReceive.receiveSuccess", "{{count}}건을 불량창고에 입고했습니다.", { count: doneCount }));
      if (failed.length > 0) toast.error(failed.map((f) => `${f.matUid}: ${f.reason}`).join("\n"), { duration: 8000 });
      setConfirmOpen(false);
      setChecked(new Set());
      setRemark("");
      await fetchPending();
    } catch {
      // api 인터셉터가 오류 모달 처리
    } finally {
      setSaving(false);
    }
  }, [fetchPending, remark, selectedRows, t, warehouseCode]);

  const pendingColumns = useMemo<ColumnDef<PendingRow>[]>(() => [
    {
      id: "check",
      header: () => (
        <input type="checkbox" aria-label={t("common.selectAll", "전체 선택")} checked={allChecked} onChange={toggleAll} />
      ),
      size: 44,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="text-center">
          <input type="checkbox" checked={checked.has(row.original.matUid)} onChange={() => toggle(row.original.matUid)} aria-label={row.original.matUid} />
        </div>
      ),
    },
    { accessorKey: "matUid", header: t("material.col.matUid", "자재 시리얼"), size: 190, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span> },
    { accessorKey: "arrivalNo", header: t("material.col.arrivalNo", "입하번호"), size: 130, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono">{(getValue() as string) ?? "-"}</span> },
    { accessorKey: "itemCode", header: t("common.partCode", "품목코드"), size: 140, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span> },
    { accessorKey: "itemName", header: t("common.partName", "품목명"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "vendorName", header: t("material.col.supplier", "거래처"), size: 120, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.vendorName ?? row.original.vendorCode ?? "-" },
    { accessorKey: "qty", header: t("common.qty", "수량"), size: 90, meta: { summary: "sum" as const, filterType: "number" as const }, cell: ({ row }) => <div className="text-right tabular-nums">{Number(row.original.qty).toLocaleString()} {row.original.unit ?? ""}</div> },
    { accessorKey: "fromWarehouseCode", header: t("material.iqcDefectReceive.col.fromWarehouse", "입하창고"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "judgedAt", header: t("material.iqcDefectReceive.col.judgedAt", "불합격 판정일시"), size: 150, meta: { filterType: "date" as const }, cell: ({ getValue }) => fmtDateTime(getValue() as string) },
    { accessorKey: "inspectorName", header: t("material.col.inspector", "검사자"), size: 90, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) ?? "-" },
    { accessorKey: "judgeReason", header: t("material.iqcDefectReceive.col.reason", "불합격 사유"), size: 260, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="truncate block" title={(getValue() as string) ?? ""}>{(getValue() as string) ?? "-"}</span> },
    { accessorKey: "recvDate", header: t("material.col.arrivalDate", "입하일"), size: 100, meta: { filterType: "date" as const }, cell: ({ getValue }) => fmtDate(getValue() as string) },
  ], [allChecked, checked, t, toggle, toggleAll]);

  // ── 이력 ──
  const today = getTodayLocal();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [historySearch, setHistorySearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<HistoryRow | null>(null);
  const [canceling, setCanceling] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/material/iqc-defect-receive/history", {
        params: { fromDate, toDate, ...(historySearch ? { search: historySearch } : {}) },
      });
      setHistory(res.data?.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [fromDate, toDate, historySearch]);
  useEffect(() => { if (tab === "history") void fetchHistory(); }, [tab, fetchHistory]);

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCanceling(true);
    try {
      await api.post("/material/iqc-defect-receive/cancel", { transNo: cancelTarget.transNo });
      toast.success(t("material.iqcDefectReceive.cancelSuccess", "불량창고 입고를 취소하고 입하재고로 원복했습니다."));
      setCancelTarget(null);
      await Promise.all([fetchHistory(), fetchPending()]);
    } catch {
      // api 인터셉터
    } finally {
      setCanceling(false);
    }
  }, [cancelTarget, fetchHistory, fetchPending, t]);

  const refTypeLabel = useCallback((refType: string) => {
    switch (refType) {
      case "IQC_DEFECT_RECEIVE": return t("material.iqcDefectReceive.refType.receive", "불량창고 입고");
      case "IQC_DEFECT_RECEIVE_CANCEL": return t("material.iqcDefectReceive.refType.receiveCancel", "입고 취소");
      case "IQC_FAIL": return t("material.iqcDefectReceive.refType.autoMove", "자동이동(IQC FAIL)");
      case "IQC_FAIL_CANCEL": return t("material.iqcDefectReceive.refType.autoMoveCancel", "자동이동 취소");
      default: return refType;
    }
  }, [t]);

  const historyColumns = useMemo<ColumnDef<HistoryRow>[]>(() => [
    {
      id: "actions",
      header: "",
      size: 90,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const r = row.original;
        const cancelable = r.refType === "IQC_DEFECT_RECEIVE" && !r.canceledBy;
        const reason = r.canceledBy
          ? t("material.iqcDefectReceive.alreadyCanceled", "이미 취소된 입고입니다.")
          : t("material.iqcDefectReceive.notCancelable", "수동 입고 건만 취소할 수 있습니다.");
        const btn = (
          <button
            type="button"
            disabled={!cancelable}
            onClick={(e) => { e.stopPropagation(); if (cancelable) setCancelTarget(r); }}
            className={`disabled:pointer-events-none inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border ${
              cancelable ? "text-red-600 border-red-400 hover:bg-red-600 hover:text-white" : "text-text-muted border-border opacity-50 cursor-not-allowed"
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />{t("material.iqcDefectReceive.cancelBtn", "입고취소")}
          </button>
        );
        return cancelable ? btn : <HelpTooltip description={reason} focusable>{btn}</HelpTooltip>;
      },
    },
    { accessorKey: "transDate", header: t("material.iqcDefectReceive.col.transDate", "처리일시"), size: 150, meta: { filterType: "date" as const }, cell: ({ getValue }) => fmtDateTime(getValue() as string) },
    { accessorKey: "refType", header: t("common.type", "구분"), size: 140, meta: { filterType: "text" as const }, cell: ({ row }) => (
      <span className={row.original.canceledBy ? "line-through text-text-muted" : ""}>{refTypeLabel(row.original.refType)}</span>
    ) },
    { accessorKey: "transNo", header: t("material.iqcDefectReceive.col.transNo", "트랜잭션"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span> },
    { accessorKey: "matUid", header: t("material.col.matUid", "자재 시리얼"), size: 190, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono">{(getValue() as string) ?? "-"}</span> },
    { accessorKey: "itemCode", header: t("common.partCode", "품목코드"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName", "품목명"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "qty", header: t("common.qty", "수량"), size: 90, meta: { summary: "sum" as const, filterType: "number" as const }, cell: ({ getValue }) => <div className="text-right tabular-nums">{Number(getValue()).toLocaleString()}</div> },
    { accessorKey: "fromWarehouseId", header: t("material.iqcDefectReceive.col.fromWarehouse", "출고창고"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "toWarehouseId", header: t("material.iqcDefectReceive.col.toWarehouse", "입고창고"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "remark", header: t("common.remark", "비고"), size: 220, meta: { filterType: "text" as const } },
  ], [refTypeLabel, t]);

  const receiveDisabledReason = selectedRows.length === 0
    ? t("material.iqcDefectReceive.disabled.noSelection", "입고할 시리얼을 스캔하거나 체크하세요.")
    : !warehouseCode
      ? t("material.iqcDefectReceive.disabled.noWarehouse", "불량창고를 선택하세요.")
      : t("common.actionProcessingHelp", "처리 중입니다. 완료될 때까지 기다려 주세요.");

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackageX className="w-7 h-7 text-primary" />
            {t("material.iqcDefectReceive.title", "IQC불합격자재 불량창고입고")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.iqcDefectReceive.description", "수입검사 불합격 LOT을 확인하고 불량창고에 입고 처리합니다. 불합격 LOT은 입고 전까지 입하재고에 남아 있습니다.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hv-seg flex rounded-lg border border-border overflow-hidden" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}
              className={`px-3 py-1.5 text-sm ${tab === "pending" ? "bg-primary text-white" : "text-text hover:bg-surface"}`}>
              {t("material.iqcDefectReceive.tabPending", "입고 대기")} ({pending.length})
            </button>
            <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}
              className={`px-3 py-1.5 text-sm ${tab === "history" ? "bg-primary text-white" : "text-text hover:bg-surface"}`}>
              {t("material.iqcDefectReceive.tabHistory", "입고 이력")}
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => (tab === "pending" ? fetchPending() : fetchHistory())}>
            <RefreshCw className={`w-4 h-4 mr-1 ${(tab === "pending" ? loading : historyLoading) ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          {tab === "pending" ? (
            <DataGrid
              data={pending}
              columns={pendingColumns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName="iqc_defect_receive_pending"
              getRowId={(row) => row.matUid}
              sqlQuery={`SELECT lot.MAT_UID, lot.ARRIVAL_NO, lot.ITEM_CODE, ast.QTY, ast.WAREHOUSE_CODE\nFROM MAT_LOTS lot JOIN MAT_ARRIVAL_STOCKS ast ON ast.MAT_UID = lot.MAT_UID\nWHERE lot.IQC_STATUS = 'FAIL' AND NVL(lot.SPECIAL_ACCEPT_YN,'N') <> 'Y' AND lot.STATUS = 'NORMAL' AND ast.QTY > 0\n  AND lot.COMPANY = '40' AND lot.PLANT_CD = '1000'`}
              toolbarLeft={
                <div className="flex flex-wrap gap-2 flex-1 min-w-0 items-center">
                  <div className="w-64 flex-shrink-0">
                    <BarcodeScanInput
                      value={scanValue}
                      onChange={setScanValue}
                      onScan={handleScan}
                      autoClear
                      maintainFocus
                      blinkIndicator
                      refocusAfterScan
                      placeholder={t("material.iqcDefectReceive.scanPlaceholder", "시리얼/입하번호 스캔 → 선택")}
                      fullWidth
                    />
                  </div>
                  <div className="w-52 flex-shrink-0">
                    <Input placeholder={t("material.iqcDefectReceive.searchPlaceholder", "시리얼·입하번호·품목 검색")} value={search}
                      onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-52 flex-shrink-0">
                    <WarehouseSelect
                      aria-label={t("material.iqcDefectReceive.warehouse", "불량창고")}
                      warehouseType="DEFECT"
                      autoSelectDefault
                      value={warehouseCode}
                      onChange={setWarehouseCode}
                      fullWidth
                    />
                  </div>
                  <div className="w-56 flex-shrink-0">
                    <Input placeholder={t("common.remark", "비고")} value={remark} onChange={(e) => setRemark(e.target.value)} fullWidth />
                  </div>
                  <Button size="sm" onClick={() => setConfirmOpen(true)}
                    disabled={selectedRows.length === 0 || !warehouseCode || saving}
                    disabledReason={receiveDisabledReason}
                    leftIcon={<WarehouseIcon className="w-4 h-4" />}>
                    {t("material.iqcDefectReceive.receiveBtn", "불량창고 입고")} ({selectedRows.length})
                  </Button>
                </div>
              }
            />
          ) : (
            <DataGrid
              data={history}
              columns={historyColumns}
              isLoading={historyLoading}
              enableColumnFilter
              enableExport
              exportFileName="iqc_defect_receive_history"
              getRowId={(row) => row.transNo}
              sqlQuery={`SELECT * FROM STOCK_TRANSACTIONS\nWHERE REF_TYPE IN ('IQC_DEFECT_RECEIVE','IQC_DEFECT_RECEIVE_CANCEL','IQC_FAIL','IQC_FAIL_CANCEL')\n  AND COMPANY = '40' AND PLANT_CD = '1000'\nORDER BY TRANS_DATE DESC`}
              toolbarLeft={
                <div className="flex flex-wrap gap-2 flex-1 min-w-0 items-center">
                  <DateRangeFilter from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} presets />
                  <div className="w-56 flex-shrink-0">
                    <Input placeholder={t("material.iqcDefectReceive.searchPlaceholder", "시리얼·입하번호·품목 검색")} value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                </div>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* 입고 확인 */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title={t("material.iqcDefectReceive.confirmTitle", "불량창고 입고 확인")} size="lg">
        <div className="space-y-3 text-sm">
          <p>{t("material.iqcDefectReceive.confirmMessage", "선택한 {{count}}건(총 {{qty}})을 불량창고 {{warehouse}}에 입고합니다. 입하재고에서 차감되고 불량창고 재고로 이동합니다.", { count: selectedRows.length, qty: selectedQty.toLocaleString(), warehouse: warehouseCode })}</p>
          <div className="max-h-60 overflow-y-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface sticky top-0"><tr><th className="px-2 py-1 text-left">{t("material.col.matUid", "자재 시리얼")}</th><th className="px-2 py-1 text-left">{t("common.partCode", "품목코드")}</th><th className="px-2 py-1 text-right">{t("common.qty", "수량")}</th></tr></thead>
              <tbody>
                {selectedRows.map((r) => (
                  <tr key={r.matUid} className="border-t border-border"><td className="px-2 py-1 font-mono">{r.matUid}</td><td className="px-2 py-1 font-mono">{r.itemCode}</td><td className="px-2 py-1 text-right tabular-nums">{Number(r.qty).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button onClick={handleReceive} disabled={saving} isLoading={saving}>{t("material.iqcDefectReceive.receiveBtn", "불량창고 입고")}</Button>
          </div>
        </div>
      </Modal>

      {/* 취소 확인 */}
      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title={t("material.iqcDefectReceive.cancelTitle", "불량창고 입고 취소")} size="md">
        <div className="space-y-3 text-sm">
          <p>{t("material.iqcDefectReceive.cancelConfirm", "{{matUid}} ({{qty}})의 불량창고 입고를 취소하고 입하재고로 원복합니다. 불량창고 재고가 이미 사용·이동된 경우 취소할 수 없습니다.", { matUid: cancelTarget?.matUid ?? "", qty: Number(cancelTarget?.qty ?? 0).toLocaleString() })}</p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={canceling}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={handleCancel} disabled={canceling} isLoading={canceling}>{t("material.iqcDefectReceive.cancelBtn", "입고취소")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
