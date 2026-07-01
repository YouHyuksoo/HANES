"use client";

/**
 * @file src/app/(authenticated)/material/po-status/page.tsx
 * @description PO현황 페이지 - 좌측 마스터(PO목록) + 우측 디테일(품목 입고현황)
 *
 * 초보자 가이드:
 * 1. **좌측 패널**: PO 목록 (마스터) - 클릭 시 우측에 해당 PO의 품목 입고현황 표시
 * 2. **우측 패널**: 선택된 PO의 품목별 입고율 (디테일)
 * 3. API: GET /material/po-status
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useComCodeMap } from "@/hooks/useComCode";
import { ClipboardList, Search, RefreshCw, Package, Zap } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/Modal";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import FilterBar from "@/components/shared/FilterBar";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import toast from "react-hot-toast";
import {
  createPoStatusGridColumns,
  createPoStatusDetailGridColumns,
  type PoStatusRaw,
} from "./poStatusColumns";

/** Date → 'YYYY-MM-DD' (로컬 기준, UTC 변환으로 인한 하루 밀림 방지) */
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function PoStatusPage() {
  const { t } = useTranslation();
  const poStatusMap = useComCodeMap("PO_STATUS");

  const [data, setData] = useState<PoStatusRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [erpIfRunning, setErpIfRunning] = useState(false);
  const [erpIfConfirmOpen, setErpIfConfirmOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPo, setSelectedPo] = useState<PoStatusRaw | null>(null);
  // 발주일 필터 기본값: 과거 1개월 ~ 현시점
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toYmd(d);
  });
  const [toDate, setToDate] = useState(() => toYmd(new Date()));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/material/po-status", { params });
      const list = res.data?.data ?? [];
      setData(list);
      if (selectedPo) {
        const updated = list.find((p: PoStatusRaw) => p.poNo === selectedPo.poNo);
        setSelectedPo(updated ?? list[0] ?? null);
      } else if (list.length > 0) {
        setSelectedPo(list[0]);
      }
    } catch {
      setData([]);
      setSelectedPo(null);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleErpIfConfirm = useCallback(async () => {
    setErpIfConfirmOpen(false);
    setErpIfRunning(true);
    try {
      // TODO: ERP PO I/F 백엔드 구현 후 실제 endpoint 연결
      // await api.post("/interface/erp/po-sync");
      // fetchData();
      toast.error("ERP PO I/F가 아직 구현되지 않았습니다.");
    } finally {
      setErpIfRunning(false);
    }
  }, []);

  /** 마스터 그리드 컬럼 */
  const masterColumns = useMemo(() => createPoStatusGridColumns({ t, poStatusMap }), [t, poStatusMap]);

  /** 디테일 그리드 컬럼 (품목별 입고현황) */
  const detailColumns = useMemo(() => createPoStatusDetailGridColumns({ t }), [t]);

  const detailItems = selectedPo?.items ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("material.poStatus.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.poStatus.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setErpIfConfirmOpen(true)} disabled={erpIfRunning}>
            <Zap className={`w-4 h-4 mr-1 ${erpIfRunning ? "animate-pulse" : ""}`} />
            ERP PO I/F
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 마스터-디테일 좌우 분할 */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* 좌측: PO 마스터 */}
        <div className="col-span-6 min-h-0">
          <Card className="h-full overflow-hidden" padding="none"><CardContent className="h-full p-4">
            <DataGrid data={data} columns={masterColumns} isLoading={loading}
              enableColumnFilter enableExport enableFullscreen
              exportFileName={t("material.poStatus.title")}
              onRowClick={(row) => setSelectedPo(row)}
              selectedRowId={selectedPo?.poNo}
              getRowId={(row) => row.poNo}
              toolbarLeft={
                <FilterBar>
                  <DateRangeFilter
                    label={t("material.po.orderDate", "발주일")}
                    from={fromDate}
                    to={toDate}
                    onFromChange={setFromDate}
                    onToChange={setToDate}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-[120px]">
                    <Input placeholder={t("material.poStatus.searchPlaceholder")}
                      value={searchText} onChange={e => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <ComCodeSelect groupCode="PO_STATUS" labelPrefix={t("common.status")}
                      value={statusFilter} onChange={setStatusFilter} fullWidth />
                  </div>
                </FilterBar>
              }
              sqlQuery={`SELECT *\nFROM PO_HEADERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent></Card>
        </div>

        {/* 우측: 품목 입고현황 디테일 */}
        <div className="col-span-6 min-h-0">
          <Card className="h-full overflow-hidden" padding="none">
            <CardContent className="h-full p-4">
              {selectedPo ? (
                <div className="h-full">
                  <DataGrid data={detailItems} columns={detailColumns}
                    enableExport exportFileName={`${selectedPo.poNo}_status`}
                    enableFullscreen 
                    sqlQuery={`SELECT *\nFROM PO_HEADERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                  <Package className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">{t("material.poStatus.selectPoHint", "PO를 선택하면 품목 입고현황이 표시됩니다")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        isOpen={erpIfConfirmOpen}
        onClose={() => setErpIfConfirmOpen(false)}
        onConfirm={handleErpIfConfirm}
        title="ERP PO I/F 실행"
        message={
          <span>
            ERP에서 PO 데이터를 가져와 MES에 동기화합니다.<br />
            실행하시겠습니까?
          </span>
        }
        confirmText="실행"
        isLoading={erpIfRunning}
      />
    </div>
  );
}
