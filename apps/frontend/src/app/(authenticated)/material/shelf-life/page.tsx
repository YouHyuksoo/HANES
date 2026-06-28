"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Timer, Search, RefreshCw,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { PartSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { createShelfLifeGridColumns, type ShelfLifeItem } from "./shelfLifeColumns";

export default function ShelfLifePage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [data, setData] = useState<ShelfLifeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (expiryFilter) params.expiryStatus = expiryFilter;
      const res = await api.get("/material/shelf-life", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, expiryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 만료임박·만료됨만 대상으로 한다
  const expiryOptions = useMemo(() => [
    { value: "", label: `${t("material.shelfLife.nearExpiry")} + ${t("material.shelfLife.expired")}` },
    { value: "EXPIRED", label: t("material.shelfLife.expired") },
    { value: "NEAR_EXPIRY", label: t("material.shelfLife.nearExpiry") },
  ], [t]);

  // 만료임박/만료됨만 노출 + 품목 필터 적용
  const visibleData = useMemo(
    () =>
      data.filter(
        (d) =>
          (d.expiryStatus === "EXPIRED" || d.expiryStatus === "NEAR_EXPIRY") &&
          (!itemFilter || d.itemCode === itemFilter)
      ),
    [data, itemFilter]
  );

  const rowClassName = useCallback((row: ShelfLifeItem) => {
    if (row.expiryStatus === "DISCARDED") return "!bg-gray-50/50 dark:!bg-gray-900/20 opacity-60";
    if (row.expiryStatus === "EXPIRED") return "!bg-red-50/50 dark:!bg-red-950/20";
    if (row.expiryStatus === "NEAR_EXPIRY") return "!bg-yellow-50/50 dark:!bg-yellow-950/20";
    return "";
  }, []);

  const columns = useMemo(
    () =>
      createShelfLifeGridColumns({
        t,
        onReinspect: (matUid) => router.push(`/material/shelf-life-reinspect?matUid=${matUid}`),
      }),
    [t, router]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Timer className="w-7 h-7 text-primary" />{t("material.shelfLife.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.shelfLife.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 데이터 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
      sqlQuery={`SELECT *\nFROM MAT_LOTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`} data={visibleData} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("material.shelfLife.title")}
            rowClassName={rowClassName}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("material.shelfLife.searchPlaceholder")}
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-48 flex-shrink-0">
                  <PartSelect labelPrefix={t("common.partName", "품목")} value={itemFilter} onChange={setItemFilter} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={expiryOptions} value={expiryFilter} onChange={setExpiryFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
