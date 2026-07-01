"use client";

/**
 * @file src/app/(authenticated)/inventory/material-physical-inv-apply/page.tsx
 * @description 자재재고실사 반영 페이지 - 실사 수량 입력/보정 → 재고 반영
 *
 * 초보자 가이드:
 * 1. 실사등록 화면에서 개시한 세션의 PDA 스캔 수량을 불러온다(읽기 시작점).
 * 2. **수량 입력/보정**: 실사 수량을 직접 입력하거나 PDA 스캔값을 보정한다.
 * 3. **실사 반영**: [실사반영] 버튼 → MatStock 업데이트 + InvAdjLog 기록.
 * 4. 세션 개시/완료는 별도 화면 '자재재고실사관리'에서 처리한다.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckSquare, Search, RefreshCw, Calendar, ClipboardCheck,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { WarehouseSelect } from "@/components/shared";
import api from "@/services/api";
import { ApplyConfirmModal } from "../material-physical-inv/components/SessionModals";
import { createMaterialPhysicalInvApplyGridColumns } from "./materialPhysicalInvApplyColumns";

interface SessionInfo {
  status: string;
  warehouseCode: string | null;
}

interface StockForCount {
  id: string;
  warehouseCode: string;
  itemCode: string;
  itemName?: string;
  matUid?: string;
  qty: number;
  unit?: string;
  lastCountAt?: string;
  countedQty: number | null;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function MaterialPhysicalInvApplyPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<StockForCount[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [countMonth, setCountMonth] = useState(getCurrentMonth);
  const [showConfirm, setShowConfirm] = useState(false);

  const isInProgress = session?.status === "IN_PROGRESS";

  const fetchData = useCallback(async () => {
    if (!countMonth) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000", countMonth };
      if (searchText) params.search = searchText;
      if (warehouseFilter) params.warehouseCode = warehouseFilter;
      const res = await api.get("/material/physical-inv", { params });
      const result = res.data?.data ?? res.data;
      setData((result?.data ?? []).map((s: StockForCount) => ({ ...s, countedQty: s.countedQty ?? null })));
      setSession(result?.activeSession ?? null);
    } catch {
      setData([]); setSession(null);
    } finally {
      setLoading(false);
    }
  }, [searchText, warehouseFilter, countMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateCountedQty = useCallback((id: string, value: number | null) => {
    setData(prev => prev.map(row => row.id === id ? { ...row, countedQty: value } : row));
  }, []);

  const countedItems = useMemo(() => data.filter(d => d.countedQty !== null), [data]);
  const mismatchItems = useMemo(() => countedItems.filter(d => d.countedQty !== d.qty), [countedItems]);

  const handleApply = useCallback(async () => {
    if (countedItems.length === 0) return;
    setSaving(true);
    try {
      await api.post("/material/physical-inv", {
        items: countedItems.map(item => ({ stockId: item.id, countedQty: item.countedQty!, remark: "재고실사" })),
      });
      setShowConfirm(false); fetchData();
    } catch (e) { console.error("Apply failed:", e); }
    finally { setSaving(false); }
  }, [countedItems, fetchData]);

  const columns = useMemo(() => createMaterialPhysicalInvApplyGridColumns({ t, updateCountedQty }), [t, updateCountedQty]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("inventory.matPhysicalInvApply.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("inventory.matPhysicalInvApply.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isInProgress && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse">
              {t("material.physicalInv.sessionInProgress")}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => setShowConfirm(true)} disabled={countedItems.length === 0}>
            <CheckSquare className="w-4 h-4 mr-1" />{t("material.physicalInv.applyCount")} ({countedItems.length})
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("inventory.matPhysicalInvApply.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="w-40 flex-shrink-0">
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  <input type="month" value={countMonth} onChange={e => setCountMonth(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-sm border border-border rounded bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="w-40 flex-shrink-0">
                <WarehouseSelect includeAll labelPrefix={t("common.warehouse", "창고")} value={warehouseFilter} onChange={setWarehouseFilter} fullWidth />
              </div>
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.physicalInv.searchPlaceholder")} value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT *\nFROM MAT_PHYSICAL_INV\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <ApplyConfirmModal isOpen={showConfirm} onClose={() => setShowConfirm(false)}
        onApply={handleApply} saving={saving} countedCount={countedItems.length} mismatchItems={mismatchItems} />
    </div>
  );
}
