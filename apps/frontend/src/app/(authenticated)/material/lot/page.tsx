"use client";

/**
 * @file src/app/(authenticated)/material/lot/page.tsx
 * @description 자재 LOT관리 페이지 - 자재 LOT별 이력/상태 조회
 *
 * 초보자 가이드:
 * 1. **LOT**: 동일 조건으로 입하된 자재 묶음 단위
 * 2. **추적**: LOT번호로 입하→IQC→입고→출고 이력 추적 가능
 * 3. API: GET /material/lots
 * 4. **기본 조건**: 조건 없는 전량 조회 금지. 기본은 "재고 있는 LOT(잔량>0·NORMAL)" + 서버 페이징.
 *    전체/보류/소진 등 다른 상태를 볼 때는 입고일 구간(기본 당일)이 항상 붙는다.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Search, RefreshCw, Layers, CheckCircle, AlertCircle, MinusCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createLotGridColumns, type MatLotItem } from "./lotColumns";

/** 상태 셀렉트의 기본값: 재고 있는 LOT(잔량>0, NORMAL). 서버 activeOnly=true 로 전달된다. */
const LOT_ACTIVE_FILTER = "__ACTIVE__";
const PAGE_SIZE = 50;

const getIqcColor = (status: string) => {
  const c: Record<string, string> = {
    PASS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    FAIL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    PENDING: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };
  return c[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300";
};

export default function MatLotPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<MatLotItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  // 기본은 재고 있는 LOT만 — 조건 없는 전량 조회 금지
  const [statusFilter, setStatusFilter] = useState(LOT_ACTIVE_FILTER);
  const [iqcFilter, setIqcFilter] = useState("");
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [page, setPage] = useState(1);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<MatLotItem | null>(null);
  // 재고 있는 LOT 외(전체/정상/보류/소진)는 입고일 구간이 필수 — 기본 당일
  const dateRangeApplies = statusFilter !== LOT_ACTIVE_FILTER;
  useEffect(() => { setPage(1); }, [searchText, statusFilter, iqcFilter, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText) params.matUid = searchText;
      if (statusFilter === LOT_ACTIVE_FILTER) {
        params.activeOnly = "true";
      } else {
        if (statusFilter) params.status = statusFilter;
        if (fromDate) params.fromDate = fromDate;
        if (toDate) params.toDate = toDate;
      }
      if (iqcFilter) params.iqcStatus = iqcFilter;
      const res = await api.get("/material/lots", { params });
      // 백엔드는 현재고를 currentQty로 반환한다. 화면 모델(qty)로 정규화하고 수치 누락을 0으로 방어한다.
      const rows: MatLotItem[] = (res.data?.data ?? []).map((r: MatLotItem) => ({
        ...r,
        initQty: r.initQty ?? 0,
        qty: r.qty ?? r.currentQty ?? 0,
      }));
      setData(rows);
      setTotal(Number(res.data?.meta?.total ?? rows.length));
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchText, statusFilter, iqcFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const LOT_STATUS = useMemo(() => [
    { value: LOT_ACTIVE_FILTER, label: t("material.lot.status.activeOnly", "재고 있는 LOT (잔량>0·정상)") },
    { value: "", label: `LOT${t("common.status")}: ${t("common.all")}` },
    { value: "NORMAL", label: `LOT${t("common.status")}: ${t("material.lot.status.normal")}` },
    { value: "HOLD", label: `LOT${t("common.status")}: ${t("material.lot.status.hold")}` },
    { value: "DEPLETED", label: `LOT${t("common.status")}: ${t("material.lot.status.depleted")}` },
  ], [t]);

  const IQC_STATUS = useMemo(() => [
    { value: "", label: `IQC${t("common.status")}: ${t("common.all")}` },
    { value: "PASS", label: `IQC${t("common.status")}: PASS` },
    { value: "FAIL", label: `IQC${t("common.status")}: FAIL` },
    { value: "PENDING", label: `IQC${t("common.status")}: PENDING` },
  ], [t]);

  // total 은 서버 meta 기준(현재 조건 전체 건수), 상태별 건수는 현재 페이지 기준
  const stats = useMemo(() => ({
    total,
    normal: data.filter(l => l.status === "NORMAL").length,
    hold: data.filter(l => l.status === "HOLD").length,
    depleted: data.filter(l => l.status === "DEPLETED").length,
  }), [data, total]);

  const columns = useMemo(() => createLotGridColumns({
    t,
    onViewDetail: (lot) => { setSelectedLot(lot); setDetailModalOpen(true); },
  }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />{t("material.lot.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.lot.description")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("material.lot.stats.totalLot")} value={stats.total} icon={Layers} color="blue" />
        <StatCard label={t("material.lot.stats.normal")} value={stats.normal} icon={CheckCircle} color="green" />
        <StatCard label={t("material.lot.stats.hold")} value={stats.hold} icon={AlertCircle} color="yellow" />
        <StatCard label={t("material.lot.stats.depleted")} value={stats.depleted} icon={MinusCircle} color="gray" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter pageSize={PAGE_SIZE}
          enableExport exportFileName={t("material.lot.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0 items-center">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.lot.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-52 flex-shrink-0">
                <Select options={LOT_STATUS} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={IQC_STATUS} value={iqcFilter} onChange={setIqcFilter} fullWidth />
              </div>
              {/* 재고 있는 LOT 외 조회는 입고일 구간 필수 — 기본 당일 */}
              {dateRangeApplies && (
                <DateRangeFilter
                  label={t("material.lot.columns.recvDate")}
                  from={fromDate}
                  to={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                  presets
                  className="flex-shrink-0"
                />
              )}
              <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          }
          sqlQuery={`SELECT *\nFROM MAT_LOTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND STATUS = 'NORMAL' AND CURRENT_QTY > 0 -- 기본(재고 있는 LOT). 다른 상태는 RECV_DATE 구간 필수\nORDER BY CREATED_AT DESC\nOFFSET :skip ROWS FETCH NEXT :limit ROWS ONLY`}/>
      </CardContent></Card>

      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)}
        title={t("material.lot.detailTitle")} size="lg">
        {selectedLot && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.matUid")}</span>
                  <span className="font-mono font-medium">{selectedLot.matUid}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("common.partCode")}</span>
                  <span className="font-mono">{selectedLot.itemCode}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("common.partName")}</span>
                  <span>{selectedLot.itemName}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.vendor")}</span>
                  <span>{selectedLot.vendor || "-"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.recvDate")}</span>
                  <span>{selectedLot.recvDate ? new Date(selectedLot.recvDate).toLocaleDateString() : "-"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.initQty")}</span>
                  <span>{(selectedLot.initQty ?? 0).toLocaleString()} {selectedLot.unit || ""}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.currentQty")}</span>
                  <span className="font-semibold">{(selectedLot.qty ?? 0).toLocaleString()} {selectedLot.unit || ""}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">IQC</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getIqcColor(selectedLot.iqcStatus)}`}>{selectedLot.iqcStatus}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>{t("common.close")}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
