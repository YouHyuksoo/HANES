"use client";

/**
 * @file src/app/(authenticated)/equipment/inspect-history/page.tsx
 * @description 점검이력조회 페이지 - 일상/정기 점검 이력 통합 조회 (조회 전용)
 *
 * 초보자 가이드:
 * 1. **통합 조회**: 일상점검 + 정기점검 이력을 하나의 화면에서 조회
 * 2. **필터링**: 점검유형, 결과, 날짜 범위 등으로 필터링
 * 3. API: GET /equipment/inspect-history
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollText, Search, RefreshCw, ClipboardList,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ServerPager from "@/components/shared/ServerPager";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createInspectHistoryGridColumns } from "./inspectHistoryColumns";
import type { InspectDetail, InspectHistory } from "./types";

/** 서버 페이지 크기 */
const PAGE_SIZE = 200;

const inspectHistorySqlPreview = `SELECT
  log.*,
  equip.EQUIP_NAME,
  equip.EQUIP_TYPE,
  equip.LINE_CODE
FROM EQUIP_INSPECT_LOGS log
LEFT JOIN EQUIP_MASTERS equip
  ON log.EQUIP_CODE = equip.EQUIP_CODE
 AND log.COMPANY = equip.COMPANY
 AND log.PLANT_CD = equip.PLANT_CD
WHERE log.COMPANY = '40'
  AND log.PLANT_CD = '1000'
ORDER BY log.INSPECT_DATE DESC`;

export default function InspectHistoryPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<InspectHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [equipTypeFilter, setEquipTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  // 점검일 구간 — 이력 화면은 날짜 구간이 필수, 기본 당일
  const [dateFrom, setDateFrom] = useState(() => getTodayLocal());
  const [dateTo, setDateTo] = useState(() => getTodayLocal());
  const [page, setPage] = useState(1);
  const [selectedHistory, setSelectedHistory] = useState<InspectHistory | null>(null);

  useEffect(() => { setPage(1); }, [searchText, typeFilter, equipTypeFilter, resultFilter, dateFrom, dateTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText) params.search = searchText;
      if (typeFilter) params.inspectType = typeFilter;
      if (equipTypeFilter) params.equipType = equipTypeFilter;
      if (resultFilter) params.overallResult = resultFilter;
      if (dateFrom) params.inspectDateFrom = dateFrom;
      if (dateTo) params.inspectDateTo = dateTo;
      const res = await api.get("/equipment/inspect-history", { params });
      setData(res.data?.data ?? []);
      setSelectedHistory((current) => {
        if (!current) return current;
        return (res.data?.data ?? []).find((row: InspectHistory) => row.id === current.id) ?? null;
      });
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchText, typeFilter, equipTypeFilter, resultFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createInspectHistoryGridColumns(t), [t]);
  const detailItems = useMemo<InspectDetail[]>(() => {
    if (!selectedHistory?.details) return [];
    try {
      const parsed = typeof selectedHistory.details === "string"
        ? JSON.parse(selectedHistory.details)
        : selectedHistory.details;
      return Array.isArray(parsed) ? parsed : (parsed?.items ?? []);
    } catch {
      return [];
    }
  }, [selectedHistory]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ScrollText className="w-7 h-7 text-primary" />{t("equipment.inspectHistory.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.inspectHistory.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
      <Card className="flex-1 min-w-0 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.inspectHistory.title")}
          onRowClick={setSelectedHistory}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("equipment.inspectHistory.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <ComCodeSelect groupCode="INSPECT_CHECK_TYPE" labelPrefix={t("equipment.inspectHistory.inspectType", "점검유형")} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <ComCodeSelect groupCode="INSPECT_JUDGE" labelPrefix={t("equipment.inspectHistory.result", "점검결과")} value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <ComCodeSelect groupCode="EQUIP_TYPE" labelPrefix={t("equipment.inspectHistory.equipType", "설비유형")} value={equipTypeFilter} onChange={setEquipTypeFilter} fullWidth />
              </div>
              <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} className="flex-shrink-0" />
            </div>
          } 
          sqlQuery={inspectHistorySqlPreview}/>
      </CardContent></Card>
      <Card className="w-[360px] shrink-0 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 pb-3 border-b border-border shrink-0">
            <ClipboardList className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-semibold text-text">상세 점검내역</h2>
              <p className="text-xs text-text-muted">행을 선택하면 항목별 결과를 확인합니다.</p>
            </div>
          </div>
          {!selectedHistory ? (
            <div className="flex-1 flex items-center justify-center text-sm text-text-muted">조회할 이력을 선택하세요.</div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-text-muted">설비</span><p className="font-mono text-text">{selectedHistory.equipCode}</p></div>
                <div><span className="text-text-muted">점검일</span><p className="text-text">{selectedHistory.inspectDate || '-'}</p></div>
                <div><span className="text-text-muted">점검자</span><p className="text-text">{selectedHistory.inspectorName || '-'}</p></div>
                <div><span className="text-text-muted">작업지시</span><p className="font-mono text-text">{selectedHistory.orderNo || '-'}</p></div>
              </div>
              {detailItems.length === 0 ? (
                <div className="rounded border border-border p-3 text-xs text-text-muted">저장된 항목별 상세내역이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {detailItems.map((detail, index) => (
                    <div key={`${detail.itemId ?? 'item'}-${index}`} className="rounded border border-border p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-text">{detail.itemName || detail.itemId || `점검항목 ${index + 1}`}</span>
                        <span className={detail.result === 'FAIL' ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>{detail.result || '-'}</span>
                      </div>
                      {(detail.measuredValue || detail.remark || detail.reasonCode) && (
                        <p className="mt-1 text-text-muted break-words">
                          {[detail.measuredValue && `측정값: ${detail.measuredValue}`, detail.remark && `비고: ${detail.remark}`, detail.reasonCode && `사유: ${detail.reasonCode}${detail.reasonText ? ` (${detail.reasonText})` : ''}`].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
