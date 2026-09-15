"use client";

/**
 * @file quality/ncr/page.tsx
 * @description 부적합 보고서(NCR) — 발행·처리방안 확정·원인분석·종결·A4 출력
 *
 * 초보자 가이드:
 * 1. 이력성 화면이라 발행일 구간 기본값은 당일이다(DateRangeFilter 가 마운트 시 보정한다).
 * 2. 상태 흐름: OPEN(발행) → IN_PROGRESS(처리방안 확정) → CLOSED(종결).
 *    원인·재발방지는 종결 전이면 언제든 채울 수 있다.
 * 3. 종결된 건은 서버가 수정을 거부한다. 화면에서도 버튼을 감춘다.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, FileWarning, Clock, Play, CheckCircle, Search as SearchIcon,
  Printer, Pencil, ClipboardCheck, FileSearch, Lock,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import api from "@/services/api";
import NcrFormPanel from "./components/NcrFormPanel";
import NcrActionModal, { type NcrActionMode } from "./components/NcrActionModal";
import NcrPrintModal from "./components/NcrPrintModal";
import { createNcrGridColumns } from "./ncrColumns";
import type { NcrReport } from "./types";

export default function NcrPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<NcrReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<NcrReport | null>(null);

  /* -- 필터 상태 (발행일 구간은 DateRangeFilter 가 당일로 보정) -- */
  const [searchText, setSearchText] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [foundStageFilter, setFoundStageFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* -- 패널·모달 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<NcrReport | null>(null);
  const [actionMode, setActionMode] = useState<NcrActionMode | null>(null);
  const [printTarget, setPrintTarget] = useState<NcrReport | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    if (!fromDate || !toDate) return; // 날짜 보정 전에는 전량 조회하지 않는다
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000", fromDate, toDate };
      if (searchText) params.search = searchText;
      if (targetTypeFilter) params.targetType = targetTypeFilter;
      if (foundStageFilter) params.foundStage = foundStageFilter;
      if (gradeFilter) params.defectGrade = gradeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/quality/ncr", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, searchText, targetTypeFilter, foundStageFilter, gradeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* 목록이 갱신되면 선택 행도 최신 레코드로 맞춘다 (처리 직후 버튼이 옛 상태를 보지 않도록) */
  useEffect(() => {
    if (!selectedRow) return;
    const fresh = data.find((d) => d.ncrNo === selectedRow.ncrNo) ?? null;
    setSelectedRow(fresh);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- 통계 -- */
  const stats = useMemo(() => ({
    total: data.length,
    open: data.filter((d) => d.status === "OPEN").length,
    inProgress: data.filter((d) => d.status === "IN_PROGRESS").length,
    closed: data.filter((d) => d.status === "CLOSED").length,
    critical: data.filter((d) => d.defectGrade === "CRITICAL").length,
  }), [data]);

  const columns = useMemo(() => createNcrGridColumns({ t }), [t]);

  const isClosed = selectedRow?.status === "CLOSED";

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <FileWarning className="w-7 h-7 text-primary" />
              {t("quality.ncr.pageTitle", "부적합 보고서")}
            </h1>
            <p className="text-text-muted mt-1">
              {t("quality.ncr.subtitle", "원자재·반제품·완제품·재공품 부적합을 발행하고 처리·원인·종결까지 기록합니다.")}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh", "새로고침")}
            </Button>
            {selectedRow && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setPrintTarget(selectedRow)}>
                  <Printer className="w-4 h-4 mr-1" />{t("common.print", "인쇄")}
                </Button>
                {!isClosed && (
                  <>
                    <Button variant="secondary" size="sm"
                      onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
                      <Pencil className="w-4 h-4 mr-1" />{t("common.edit", "수정")}
                    </Button>
                    <Button size="sm" onClick={() => setActionMode("disposition")}>
                      <ClipboardCheck className="w-4 h-4 mr-1" />
                      {t("quality.ncr.setDisposition", "처리방안 확정")}
                    </Button>
                    <Button size="sm" onClick={() => setActionMode("cause")}>
                      <FileSearch className="w-4 h-4 mr-1" />
                      {t("quality.ncr.setCause", "원인분석")}
                    </Button>
                    <Button size="sm" onClick={() => setActionMode("close")}>
                      <Lock className="w-4 h-4 mr-1" />{t("quality.ncr.close", "종결")}
                    </Button>
                  </>
                )}
              </>
            )}
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.ncr.issue", "부적합 발행")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
          <StatCard label={t("quality.ncr.statsTotal", "전체")} value={stats.total} icon={FileWarning} color="blue" />
          <StatCard label={t("quality.ncr.statsOpen", "발행")} value={stats.open} icon={Clock} color="yellow" />
          <StatCard label={t("quality.ncr.statsInProgress", "처리중")} value={stats.inProgress} icon={Play} color="orange" />
          <StatCard label={t("quality.ncr.statsClosed", "종결")} value={stats.closed} icon={CheckCircle} color="green" />
          <StatCard label={t("quality.ncr.statsCritical", "치명")} value={stats.critical} icon={FileWarning} color="red" />
        </div>

        {/* 목록 */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("quality.ncr.pageTitle", "부적합 보고서")}
            getRowId={(row) => (row as NcrReport).ncrNo}
            selectedRowId={selectedRow?.ncrNo}
            onRowClick={(row) => setSelectedRow(row as NcrReport)}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Input placeholder={t("common.search", "검색")} value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<SearchIcon className="w-4 h-4" />} fullWidth />
                </div>
                <DateRangeFilter
                  from={fromDate}
                  to={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                  label={t("quality.ncr.issuedAt", "발행일")}
                  className="flex-shrink-0"
                />
                <ComCodeSelect groupCode="NCR_TARGET_TYPE" value={targetTypeFilter}
                  onChange={setTargetTypeFilter} labelPrefix={t("quality.ncr.targetType", "대상구분")} />
                <ComCodeSelect groupCode="NCR_FOUND_STAGE" value={foundStageFilter}
                  onChange={setFoundStageFilter} labelPrefix={t("quality.ncr.foundStage", "발견단계")} />
                <ComCodeSelect groupCode="DEFECT_GRADE" value={gradeFilter}
                  onChange={setGradeFilter} labelPrefix={t("quality.ncr.defectGrade", "결함구분")} />
                <ComCodeSelect groupCode="NCR_STATUS" value={statusFilter}
                  onChange={setStatusFilter} labelPrefix={t("common.status", "상태")} />
              </div>
            }
            sqlQuery={`SELECT *\nFROM NCR_REPORTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND ISSUED_AT BETWEEN :fromDate AND :toDate\nORDER BY ISSUED_AT DESC, NCR_NO DESC`}
          />
        </CardContent></Card>

        {/* 처리방안·원인·종결 입력 */}
        <NcrActionModal
          mode={actionMode}
          record={selectedRow}
          onClose={() => setActionMode(null)}
          onDone={fetchData}
        />

        {/* A4 출력 */}
        <NcrPrintModal record={printTarget} onClose={() => setPrintTarget(null)} />
      </div>

      {/* 우측 패널: 발행/수정 */}
      {isPanelOpen && (
        <NcrFormPanel
          key={editTarget?.ncrNo ?? "__new__"}
          editData={editTarget}
          onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
          onSave={fetchData}
        />
      )}
    </div>
  );
}
