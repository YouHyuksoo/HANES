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
import { ColumnDef } from "@tanstack/react-table";
import {
  ScrollText, Search, RefreshCw,
} from "lucide-react";
import { Card, CardContent, Button, Input, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import api from "@/services/api";

interface InspectHistory {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: string;
  inspectType: string;
  inspectDate: string;
  inspectorName: string;
  overallResult: string;
  remark: string;
}

const formatInspectDate = (value: unknown) => {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [equipTypeFilter, setEquipTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.inspectType = typeFilter;
      if (equipTypeFilter) params.equipType = equipTypeFilter;
      if (resultFilter) params.overallResult = resultFilter;
      if (dateFrom) params.inspectDateFrom = dateFrom;
      if (dateTo) params.inspectDateTo = dateTo;
      const res = await api.get("/equipment/inspect-history", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, equipTypeFilter, resultFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo<ColumnDef<InspectHistory>[]>(() => [
    {
      accessorKey: "inspectDate",
      header: t("equipment.inspectHistory.inspectDate"),
      size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => formatInspectDate(getValue()),
    },
    {
      accessorKey: "inspectType", header: t("equipment.inspectHistory.inspectType"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_CHECK_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: "equipCode", header: t("equipment.inspectHistory.equipCode"), size: 130,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "equipName", header: t("equipment.inspectHistory.equipName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "equipType", header: t("equipment.inspectHistory.equipType", "설비유형"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="EQUIP_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: "inspectorName", header: t("equipment.inspectHistory.inspector"), size: 90,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "overallResult", header: t("equipment.inspectHistory.result"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_JUDGE" code={getValue() as string} />,
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 180,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ScrollText className="w-7 h-7 text-primary" />{t("equipment.inspectHistory.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.inspectHistory.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.inspectHistory.title")}
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
    </div>
  );
}
