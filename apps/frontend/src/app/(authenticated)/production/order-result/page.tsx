"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createOrderResultGridColumns } from "./orderResultColumns";
import type { ProdOrderResultRow } from "./types";

export default function ProdOrderResultPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ProdOrderResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planDateFrom, setPlanDateFrom] = useState(() => getTodayLocal());
  const [planDateTo, setPlanDateTo] = useState(() => getTodayLocal());

  const jobOrderStatusOptions = useComCodeOptions("JOB_ORDER_STATUS");
  const statusOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    ...jobOrderStatusOptions,
  ], [jobOrderStatusOptions, t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (planDateFrom) params.planDateFrom = planDateFrom;
      if (planDateTo) params.planDateTo = planDateTo;

      const res = await api.get("/production/prod-results/summary/by-job-order", { params });
      setData(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, planDateFrom, planDateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createOrderResultGridColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("production.orderResult.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("production.orderResult.description")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("production.orderResult.title")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t("production.orderResult.searchPlaceholder")}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
                </div>
                <DateRangeFilter
                  from={planDateFrom}
                  to={planDateTo}
                  onFromChange={setPlanDateFrom}
                  onToChange={setPlanDateTo}
                  className="flex-shrink-0"
                />
              </div>
            }
            sqlQuery={`SELECT jo.ORDER_NO, jo.PLAN_DATE, jo.PLAN_QTY,\n       NVL(SUM(pr.GOOD_QTY), 0) AS GOOD_QTY,\n       NVL(SUM(pr.DEFECT_QTY), 0) AS DEFECT_QTY\nFROM JOB_ORDERS jo\nLEFT JOIN PROD_RESULTS pr\n  ON pr.ORDER_NO = jo.ORDER_NO\n AND pr.COMPANY = jo.COMPANY\n AND pr.PLANT_CD = jo.PLANT_CD\n AND pr.STATUS <> 'CANCELED'\nWHERE jo.COMPANY = '40'\n  AND jo.PLANT_CD = '1000'\nGROUP BY jo.ORDER_NO, jo.PLAN_DATE, jo.PLAN_QTY\nORDER BY jo.PLAN_DATE DESC`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
