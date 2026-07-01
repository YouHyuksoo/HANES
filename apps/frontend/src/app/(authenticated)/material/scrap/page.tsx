"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Trash, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import ScrapRegisterPanel from "./components/ScrapRegisterPanel";
import { createScrapGridColumns } from "./scrapColumns";
import type { ScrapRecord } from "./types";

export default function ScrapPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ScrapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [fromDate, setStartDate] = useState(() => getTodayLocal());
  const [toDate, setEndDate] = useState(() => getTodayLocal());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { transType: "SCRAP", limit: "5000" };
      if (searchText) params.search = searchText;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/inventory/transactions", { params });
      const raw = res.data?.data ?? [];
      setData(raw.map((r: any) => ({
        id: r.id,
        transNo: r.transNo,
        transDate: r.transDate,
        itemCode: r.part?.itemCode || "",
        itemName: r.part?.itemName || "",
        matUid: r.lot?.matUid || r.matUid || "",
        qty: Math.abs(r.qty),
        warehouseName: r.fromWarehouse?.warehouseName || "",
        remark: r.remark || "",
        status: r.status,
      })));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createScrapGridColumns(t), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Trash className="w-7 h-7 text-primary" />
            {t("material.scrap.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.scrap.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 본문: 좌측 폐기이력 + 우측 폐기등록 패널 */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* 좌측: 폐기 이력 DataGrid */}
        <Card className="flex-1 min-w-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-3">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("material.scrap.title")}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("material.scrap.searchPlaceholder")}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <DateRangeFilter
                    from={fromDate}
                    to={toDate}
                    onFromChange={setStartDate}
                    onToChange={setEndDate}
                    className="flex-shrink-0"
                  />
                </div>
              }
              sqlQuery={`SELECT *\nFROM MAT_SCRAPS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
            />
          </CardContent>
        </Card>

        {/* 우측: 폐기 등록 패널 */}
        <Card className="w-[340px] flex-shrink-0 flex flex-col overflow-hidden" padding="none">
          <ScrapRegisterPanel onCreated={fetchData} />
        </Card>
      </div>
    </div>
  );
}
