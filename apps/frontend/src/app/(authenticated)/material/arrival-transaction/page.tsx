"use client";

/**
 * @file src/app/(authenticated)/material/arrival-transaction/page.tsx
 * @description 입하수불조회 - MAT_ARRIVAL_TRANSACTIONS 기준 입하/입하취소 원장 조회
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { History, RefreshCw, Search } from "lucide-react";
import DataGrid from "@/components/data-grid/DataGrid";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import { api } from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import {
  createArrivalTransactionGridColumns,
  type ArrivalTransactionRow,
} from "./arrivalTransactionColumns";

const getToday = () => getTodayLocal();

export default function ArrivalTransactionPage() {
  const { t } = useTranslation();
  const transTypeOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "ARRIVAL_IN", label: t("material.arrivalTransaction.typeIn", "입하") },
    { value: "ARRIVAL_CANCEL", label: t("material.arrivalTransaction.typeCancel", "입하취소") },
  ], [t]);
  const statusOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "DONE", label: t("material.arrivalTransaction.statusDone", "완료") },
    { value: "CANCELED", label: t("material.arrivalTransaction.statusCanceled", "취소") },
  ], [t]);
  const getTransTypeLabel = useCallback((type: string) => {
    if (type === "ARRIVAL_IN") return t("material.arrivalTransaction.typeIn", "입하");
    if (type === "ARRIVAL_CANCEL") return t("material.arrivalTransaction.typeCancel", "입하취소");
    return type;
  }, [t]);
  const [rows, setRows] = useState<ArrivalTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    fromDate: getToday(),
    toDate: getToday(),
    transType: "",
    status: "",
    matUid: "",
    search: "",
  });

  const fetchRows = useCallback(async () => {
    if (!filters.fromDate || !filters.toDate) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: "1",
        limit: "5000",
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      };
      if (filters.transType) params.transType = filters.transType;
      if (filters.status) params.status = filters.status;
      if (filters.matUid.trim()) params.matUid = filters.matUid.trim();
      if (filters.search.trim()) params.search = filters.search.trim();

      const res = await api.get("/material/arrivals", { params });
      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (error) {
      console.error("입하수불조회 실패:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const columns = useMemo(
    () => createArrivalTransactionGridColumns({ t, getTransTypeLabel }),
    [t, getTransTypeLabel],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            {t("material.arrivalTransaction.title", "입하수불조회")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.arrivalTransaction.subtitle", "입하재고에 반영되는 입하 및 입하취소 원장을 조회합니다.")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchRows}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={rows}
            columns={columns}
            isLoading={loading}
            emptyMessage={t("material.arrivalTransaction.empty", "조회된 입하수불 내역이 없습니다.")}
            enableColumnFilter
            enableExport
            exportFileName={t("material.arrivalTransaction.title", "입하수불조회")}
            toolbarLeft={
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <DateRangeFilter
                  from={filters.fromDate}
                  to={filters.toDate}
                  onFromChange={(v) => setFilters((prev) => ({ ...prev, fromDate: v }))}
                  onToChange={(v) => setFilters((prev) => ({ ...prev, toDate: v }))}
                  className="flex-shrink-0"
                />
                <Select
                  options={transTypeOptions}
                  value={filters.transType}
                  onChange={(v) => setFilters((prev) => ({ ...prev, transType: v }))}
                  placeholder={t("common.type")}
                />
                <Select
                  options={statusOptions}
                  value={filters.status}
                  onChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
                  placeholder={t("common.status")}
                />
                <Input
                  value={filters.matUid}
                  onChange={(e) => setFilters((prev) => ({ ...prev, matUid: e.target.value }))}
                  placeholder="MAT UID"
                  className="w-44"
                />
                <div className="flex-1 min-w-0">
                  <Input
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder={t("material.arrivalTransaction.searchPlaceholder", "거래번호, 입하번호, 품목 검색")}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
              </div>
            }
            sqlQuery={`SELECT *\nFROM MAT_ARRIVAL_TRANSACTIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY TRANS_DATE DESC`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
