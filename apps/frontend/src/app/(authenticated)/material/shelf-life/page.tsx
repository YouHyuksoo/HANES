"use client";

/**
 * @file src/app/(authenticated)/material/shelf-life/page.tsx
 * @description 유수명자재 현황 - 유효기한이 있는 LOT의 만료 현황(현재상태 화면)
 *
 * 조회 원칙(조건 없는 전량 조회 금지):
 * - 기본 조건 = 관리 대상: 잔량이 있는 LOT 중 만료됨 + 만료임박 (서버 기본값, expiryStatus 생략)
 * - 상태/품목/검색어는 전부 서버 파라미터로 보내고, 서버가 page/limit 으로 잘라 준다
 * - 클라이언트에서 전량 받아 거르지 않는다 (limit 5000 금지)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Timer, Search, RefreshCw,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import { PartSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { createShelfLifeGridColumns, type ShelfLifeItem } from "./shelfLifeColumns";

/** 서버 페이지 크기 — 현황 화면은 관리 대상만 받으므로 200건 단위 */
const PAGE_SIZE = 200;

export default function ShelfLifePage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [data, setData] = useState<ShelfLifeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  // ""=관리 대상(만료+임박) — 서버 기본 조건과 동일. VALID/DISCARDED는 이 화면에서 다루지 않는다.
  const [expiryFilter, setExpiryFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [page, setPage] = useState(1);

  // 조건이 바뀌면 1페이지부터
  useEffect(() => { setPage(1); }, [searchText, expiryFilter, itemFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchText.trim()) params.search = searchText.trim();
      if (expiryFilter) params.expiryStatus = expiryFilter;
      if (itemFilter) params.itemCode = itemFilter;
      const res = await api.get("/material/shelf-life", { params });
      setData(res.data?.data ?? []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchText, expiryFilter, itemFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 만료임박·만료됨만 대상으로 한다 (""=둘 다, 서버 기본값)
  const expiryOptions = useMemo(() => [
    { value: "", label: `${t("material.shelfLife.nearExpiry")} + ${t("material.shelfLife.expired")}` },
    { value: "EXPIRED", label: t("material.shelfLife.expired") },
    { value: "NEAR_EXPIRY", label: t("material.shelfLife.nearExpiry") },
  ], [t]);

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
          <p className="text-text-muted mt-1">
            {t("material.shelfLife.subtitle")}{" "}
            <span className="text-xs">({t("material.shelfLife.activeScopeHint", "기본: 잔량이 있는 만료·만료임박 LOT")})</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 데이터 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
      sqlQuery={`SELECT *\nFROM MAT_LOTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND EXPIRE_DATE IS NOT NULL\n  AND CURRENT_QTY > 0\n  AND STATUS <> 'DISCARDED'\n  AND EXPIRE_DATE <= TRUNC(SYSDATE) + 10\nORDER BY EXPIRE_DATE ASC`} data={data} columns={columns} isLoading={loading}
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
                  <PartSelect labelPrefix={t("common.partName", "품목")} value={itemFilter} onChange={setItemFilter} includeInactive fullWidth />
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
