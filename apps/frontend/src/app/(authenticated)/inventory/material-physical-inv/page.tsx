"use client";

/**
 * @file src/app/(authenticated)/inventory/material-physical-inv/page.tsx
 * @description 자재재고실사 등록 페이지 - 실사 개시 → PDA 스캔 모니터링 → 실사 완료
 *
 * 초보자 가이드:
 * 1. **실사 개시**: [실사 개시] 버튼 → 기준년월/창고 선택 → 세션 생성 (트랜잭션 차단 시작)
 * 2. **PDA 스캔**: PDA에서 바코드 스캔 → PHYSICAL_INV_COUNT_DETAILS에 누적 → PC에서 실시간 조회(읽기전용)
 * 3. **실사 완료**: [실사 완료] 버튼 → 세션 COMPLETED (트랜잭션 차단 해제)
 * 4. **실사 반영**: 실제 수량 입력/보정 및 재고 반영은 별도 화면 '자재재고실사반영'에서 처리
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, Search, RefreshCw, CheckCircle, Calendar, Play, StopCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Badge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { WarehouseSelect } from "@/components/shared";
import api from "@/services/api";
import { StartSessionModal, CompleteSessionModal } from "./components/SessionModals";
import { createMaterialPhysicalInvGridColumns } from "./materialPhysicalInvColumns";

interface SessionInfo {
  sessionDate: string;
  seq: number;
  countMonth: string;
  status: string;
  warehouseCode: string | null;
}

interface SessionSummary {
  sessionDate: string;
  seq: number;
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

export default function MaterialPhysicalInvPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<StockForCount[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [countMonth, setCountMonth] = useState(getCurrentMonth);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [startWarehouse, setStartWarehouse] = useState("");

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
      setSessions(result?.sessions ?? []);
    } catch {
      setData([]); setSession(null); setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, warehouseFilter, countMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStartSession = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/material/physical-inv/session/start", {
        invType: "MATERIAL", countMonth, warehouseCode: startWarehouse || undefined,
      });
      setShowStartModal(false); setStartWarehouse(""); fetchData();
    } catch (e) { console.error("Start session failed:", e); }
    finally { setSaving(false); }
  }, [countMonth, startWarehouse, fetchData]);

  const handleCompleteSession = useCallback(async () => {
    if (!session) return;
    setSaving(true);
    try {
      await api.post(`/material/physical-inv/session/${session.sessionDate}/${session.seq}/complete`, {});
      setShowCompleteModal(false); fetchData();
    } catch (e) { console.error("Complete session failed:", e); }
    finally { setSaving(false); }
  }, [session, fetchData]);

  const mismatchCount = useMemo(
    () => data.filter(d => d.countedQty !== null && d.countedQty !== d.qty).length,
    [data],
  );

  const columns = useMemo(() => createMaterialPhysicalInvGridColumns({ t }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("inventory.matPhysicalInv.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("inventory.matPhysicalInv.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isInProgress && (
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse">
              {t("material.physicalInv.sessionInProgress")}
            </span>
          )}
          {!isInProgress && sessions.some(s => s.status === "COMPLETED") && (
            <Badge variant="success" size="md">
              {t("material.physicalInv.sessionCompleted")} ({sessions.filter(s => s.status === "COMPLETED").length})
            </Badge>
          )}
          {!isInProgress && (
            <Button size="sm" variant="secondary" onClick={() => setShowStartModal(true)}>
              <Play className="w-4 h-4 mr-1" />{t("material.physicalInv.startSession")}
            </Button>
          )}
          {isInProgress && (
            <Button size="sm" variant="danger" onClick={() => setShowCompleteModal(true)}>
              <StopCircle className="w-4 h-4 mr-1" />{t("material.physicalInv.completeSession")}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 완료된 실사 세션 목록 */}
      {sessions.filter(s => s.status === "COMPLETED").length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 flex-shrink-0 text-sm">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-700 dark:text-green-400">{t("material.physicalInv.sessionCompleted")}:</span>
          {sessions.filter(s => s.status === "COMPLETED").map(s => (
            <Badge key={`${s.sessionDate}-${s.seq}`} variant="success">
              {s.warehouseCode || t("common.all")} ({s.sessionDate})
            </Badge>
          ))}
        </div>
      )}

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("inventory.matPhysicalInv.title")}
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

      <StartSessionModal isOpen={showStartModal} onClose={() => setShowStartModal(false)}
        countMonth={countMonth} onCountMonthChange={setCountMonth}
        warehouse={startWarehouse} onWarehouseChange={setStartWarehouse}
        onStart={handleStartSession} saving={saving} />
      <CompleteSessionModal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)}
        onComplete={handleCompleteSession} saving={saving} mismatchCount={mismatchCount} />
    </div>
  );
}
