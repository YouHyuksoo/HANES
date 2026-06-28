"use client";

/**
 * @file src/app/(authenticated)/quality/oqc/page.tsx
 * @description OQC(출하검사) 관리 페이지 - 의뢰 생성, 검사 실행, 결과 조회
 *
 * 초보자 가이드:
 * 1. **StatCards**: 총의뢰/대기/합격/불합격 통계
 * 2. **DataGrid**: 의뢰 목록 (필터/검색/페이지네이션)
 * 3. **OqcRequestModal**: 새 OQC 의뢰 생성 (박스 선택)
 * 4. **OqcInspectModal**: 검사 실행 및 판정
 * 5. API: GET/POST /quality/oqc
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardCheck, Search, RefreshCw, Plus, Clock, CheckCircle,
  XCircle, FileText, Calendar, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { createOqcGridColumns, type OqcRequest } from "./oqcColumns";
import OqcRequestModal from "./components/OqcRequestModal";
import OqcInspectModal from "./components/OqcInspectModal";

export default function OqcPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<OqcRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0, pass: 0, fail: 0 });
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<OqcRequest | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (customerFilter) params.customer = customerFilter;
      if (dateFrom) params.fromDate = dateFrom;
      if (dateTo) params.toDate = dateTo;
      const [listRes, statsRes] = await Promise.all([
        api.get("/quality/oqc", { params }),
        api.get("/quality/oqc/stats"),
      ]);
      setData(listRes.data?.data ?? []);
      setStats(statsRes.data?.data ?? { total: 0, pending: 0, pass: 0, fail: 0 });
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, customerFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRowClick = useCallback((row: OqcRequest) => {
    setSelectedRequest(row);
    setIsInspectModalOpen(true);
  }, []);

  const columns = useMemo(() => createOqcGridColumns({ t, onRowAction: handleRowClick }), [t, handleRowClick]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("quality.oqc.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("quality.oqc.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsRequestModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("quality.oqc.createRequest")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("quality.oqc.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("quality.oqc.statPending")} value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label={t("quality.oqc.statPass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("quality.oqc.statFail")} value={stats.fail} icon={XCircle} color="red" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("quality.oqc.title")}
          toolbarLeft={
            <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder={t("quality.oqc.searchPlaceholder")}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <DateRangeFilter
                from={dateFrom}
                to={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
                className="flex-shrink-0"
              />
              <ComCodeSelect groupCode="OQC_STATUS" labelPrefix={t('common.status')} value={statusFilter} onChange={setStatusFilter} fullWidth />
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM OQC_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <OqcRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={fetchData}
      />

      {selectedRequest && (
        <OqcInspectModal
          isOpen={isInspectModalOpen}
          onClose={() => { setIsInspectModalOpen(false); setSelectedRequest(null); }}
          requestId={selectedRequest.id}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
