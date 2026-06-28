"use client";

/**
 * @file src/app/(authenticated)/material/shelf-life-history/page.tsx
 * @description 유수명자재 검사이력 조회 - 재검사(IQC RETEST) 결과 이력을 조회/필터/내보내기
 *
 * 초보자 가이드:
 * 1. **이력 조회**: 유수명자재 재검사(IqcLog inspectType=RETEST) 결과를 읽기 전용으로 조회
 * 2. **필터**: 품목 / 결과(합격·불합격) / 검색어(LOT·품목)
 * 3. 데이터 출처 API: GET /material/shelf-life/reinspect
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { History, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { PartSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import ShelfLifeDetailModal, { type ShelfLifeDetailRecord } from "./ShelfLifeDetailModal";
import { createShelfLifeHistoryGridColumns, type ReinspectHistoryItem } from "./shelfLifeHistoryColumns";

export default function ShelfLifeHistoryPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ReinspectHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [detailRecord, setDetailRecord] = useState<ShelfLifeDetailRecord | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "2000" };
      if (resultFilter) params.result = resultFilter;
      const res = await api.get("/material/shelf-life/reinspect", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [resultFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resultOptions = useMemo(() => [
    { value: "", label: `${t("common.result", "결과")}: ${t("common.all", "전체")}` },
    { value: "PASS", label: t("material.shelfLife.pass", "합격") },
    { value: "FAIL", label: t("material.shelfLife.fail", "불합격") },
  ], [t]);

  // 품목/검색어 클라이언트 필터
  const visibleData = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return data.filter((d) => {
      if (itemFilter && d.itemCode !== itemFilter) return false;
      if (!keyword) return true;
      return [d.matUid, d.itemCode, d.itemName, d.inspectorName]
        .some((v) => String(v ?? "").toLowerCase().includes(keyword));
    });
  }, [data, itemFilter, searchText]);

  const columns = useMemo(() => createShelfLifeHistoryGridColumns({
    t,
    onViewDetail: setDetailRecord,
  }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            {t("menu.material.shelfLifeHistory", "유수명자재 검사이력")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("material.shelfLife.historySubtitle", "유수명자재 재검사 결과 이력을 조회합니다.")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 이력 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
      sqlQuery={`SELECT *\nFROM MAT_LOTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
            data={visibleData}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("menu.material.shelfLifeHistory", "유수명자재 검사이력")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t("material.shelfLife.searchPlaceholder", "LOT·품목 검색...")}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                <div className="w-48 flex-shrink-0">
                  <PartSelect labelPrefix={t("common.partName", "품목")} value={itemFilter} onChange={setItemFilter} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      <ShelfLifeDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
    </div>
  );
}
