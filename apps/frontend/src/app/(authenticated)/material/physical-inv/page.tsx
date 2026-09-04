"use client";

/**
 * @file src/app/(authenticated)/material/physical-inv/page.tsx
 * @description 재고실사 페이지 - 시스템 재고 vs 실제 재고 대사 + 반영
 *
 * 초보자 가이드:
 * 1. **실사 대상**: API에서 MatStock 목록 조회 (창고/검색 필터)
 * 2. **실사수량 입력**: 각 행의 countedQty 칸에 실제 수량 입력
 * 3. **반영**: 입력 완료 후 [실사반영] 버튼 → 차이분 InvAdjLog 기록 + Stock 업데이트
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, Search, RefreshCw, CheckSquare, AlertTriangle, CheckCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, Modal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import ServerPager from "@/components/shared/ServerPager";
import { WarehouseSelect } from "@/components/shared";
import api from "@/services/api";
import { createPhysicalInvGridColumns, StockForCount } from "./physicalInvColumns";

/** 서버 페이지당 건수 — 전량(limit 5000)을 받아 클라이언트에서 거르지 않는다 */
const PAGE_SIZE = 100;

/** GET /material/physical-inv 응답 (ResponseUtil.success 로 감싼 페이징 결과) */
interface PhysicalInvListPayload {
  data: Omit<StockForCount, "countedQty">[];
  total: number;
  page: number;
  limit: number;
}

export default function PhysicalInvPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<StockForCount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  // 현재상태 화면의 기본 활성 조건 — 수량 > 0 인 재고만. 0재고는 사용자가 명시적으로 포함할 때만.
  const [includeZeroQty, setIncludeZeroQty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // 실사수량 입력값은 서버 페이지를 넘겨도 유지되도록 행 id 별로 따로 보관한다.
  const [countedRows, setCountedRows] = useState<Map<string, StockForCount>>(() => new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText) params.search = searchText;
      if (warehouseFilter) params.warehouseCode = warehouseFilter;
      if (includeZeroQty) params.includeZeroQty = "Y";
      const res = await api.get<{ data?: PhysicalInvListPayload }>("/material/physical-inv", { params });
      const payload = res.data?.data;
      const rows: StockForCount[] = (payload?.data ?? []).map((s) => ({ ...s, countedQty: null }));
      setData(rows);
      setTotal(payload?.total ?? rows.length);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchText, warehouseFilter, includeZeroQty, page]);

  useEffect(() => { setPage(1); }, [searchText, warehouseFilter, includeZeroQty]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const updateCountedQty = useCallback((id: string, value: number | null) => {
    setCountedRows((prev) => {
      const next = new Map(prev);
      const base = data.find((row) => row.id === id) ?? prev.get(id);
      if (value === null || !base) next.delete(id);
      else next.set(id, { ...base, countedQty: value });
      return next;
    });
  }, [data]);

  // 현재 페이지 행에 보관 중인 입력값을 덧씌워 표시한다.
  const displayRows = useMemo(
    () => data.map((row) => countedRows.get(row.id) ?? row),
    [data, countedRows],
  );

  const countedItems = useMemo(() => Array.from(countedRows.values()), [countedRows]);
  const mismatchItems = useMemo(() =>
    countedItems.filter(d => d.countedQty !== d.qty), [countedItems]);

  const stats = useMemo(() => ({
    total,
    counted: countedItems.length,
    mismatch: mismatchItems.length,
    matched: countedItems.filter(d => d.countedQty === d.qty).length,
  }), [total, countedItems, mismatchItems]);

  const zeroQtyOptions = useMemo(() => [
    { value: "N", label: t("material.physicalInv.inStockOnly", "재고 있는 것만") },
    { value: "Y", label: t("material.physicalInv.includeZeroQty", "0재고 포함") },
  ], [t]);

  const handleApply = useCallback(async () => {
    if (countedItems.length === 0) return;
    setSaving(true);
    try {
      await api.post("/material/physical-inv", {
        items: countedItems.map(item => ({
          stockId: item.id,
          countedQty: item.countedQty!,
          remark: "재고실사",
        })),
      });
      setShowConfirm(false);
      setCountedRows(new Map());
      fetchData();
    } catch (e: unknown) {
      console.error("Apply failed:", e);
    } finally {
      setSaving(false);
    }
  }, [countedItems, fetchData]);

  const columns = useMemo(() => createPhysicalInvGridColumns({ t, updateCountedQty }), [t, updateCountedQty]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("material.physicalInv.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.physicalInv.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => setShowConfirm(true)} disabled={countedItems.length === 0}>
            <CheckSquare className="w-4 h-4 mr-1" />
            {t("material.physicalInv.applyCount")} ({countedItems.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("material.physicalInv.stats.total")} value={stats.total} icon={ClipboardList} color="blue" />
        <StatCard label={t("material.physicalInv.stats.counted")} value={stats.counted} icon={CheckSquare} color="purple" />
        <StatCard label={t("material.physicalInv.stats.mismatch")} value={stats.mismatch} icon={AlertTriangle} color="red" />
        <StatCard label={t("material.physicalInv.stats.matched")} value={stats.matched} icon={CheckCircle} color="green" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={displayRows} columns={columns} isLoading={loading} pageSize={PAGE_SIZE} enableColumnFilter enableExport exportFileName={t("material.physicalInv.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.physicalInv.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <WarehouseSelect includeAll labelPrefix={t("common.warehouse", "창고")} value={warehouseFilter} onChange={setWarehouseFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select aria-label={t("material.physicalInv.includeZeroQty", "0재고 포함")} options={zeroQtyOptions}
                  value={includeZeroQty ? "Y" : "N"} onChange={(v) => setIncludeZeroQty(v === "Y")} fullWidth />
              </div>
              <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} disabled={loading} className="flex-shrink-0" />
            </div>
          } 
          sqlQuery={`SELECT *\nFROM MAT_PHYSICAL_INV\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      {/* 실사반영 확인 모달 */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)}
        title={t("material.physicalInv.applyCount")} size="lg">
        <div className="space-y-4">
          <p className="text-text">{t("material.physicalInv.confirmMessage", { count: countedItems.length })}</p>
          {mismatchItems.length > 0 && (
            <div className="bg-surface-alt dark:bg-surface rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
              {mismatchItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm border-b border-border pb-1">
                  <span className="text-text">{item.itemCode} — {item.itemName}</span>
                  <span className={
                    (item.countedQty! - item.qty) > 0
                      ? "text-blue-600 font-medium"
                      : "text-red-600 font-medium"
                  }>
                    {item.qty.toLocaleString()} → {item.countedQty!.toLocaleString()} ({(item.countedQty! - item.qty) > 0 ? "+" : ""}
                    {(item.countedQty! - item.qty).toLocaleString()})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleApply} disabled={saving}>
            {saving ? t("common.saving") : t("material.physicalInv.applyCount")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
