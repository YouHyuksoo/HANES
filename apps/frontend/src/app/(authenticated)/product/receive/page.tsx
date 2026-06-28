"use client";

/**
 * @file src/app/(authenticated)/product/receive/page.tsx
 * @description 제품입고관리 페이지 - 좌측 입고이력 + 우측 박스 스캔/입고 작업 패널
 *
 * 초보자 가이드:
 * 1. 좌측: 완제품(FG) 입고 이력 그리드
 * 2. 우측: 상단 고정 스캔영역 + 입고 가능 박스(포장완료·미입고) 목록 → 선택 일괄입고
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PackageCheck, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import { getTodayLocal } from "@/utils/date";
import ReceivablePanel from "./components/ReceivablePanel";
import { createProductReceiveGridColumns, type ProductTransaction } from "./productReceiveColumns";

function extractTransactions(response: { data?: unknown }): ProductTransaction[] {
  const body = response.data as { data?: unknown } | ProductTransaction[] | undefined;
  const list = body && !Array.isArray(body) && "data" in body ? body.data : body;
  return Array.isArray(list) ? list as ProductTransaction[] : [];
}

function mergeTransactions(...groups: ProductTransaction[][]): ProductTransaction[] {
  const merged = new Map<string, ProductTransaction>();
  for (const row of groups.flat()) {
    merged.set(row.transNo || row.id, row);
  }
  return [...merged.values()].sort((a, b) => String(b.transDate).localeCompare(String(a.transDate)));
}

export default function ProductReceivePage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());

  /** 제품(FG) 입고 이력 조회 — 제품입고만, 선택 기간 내(기본 당일). 공정출고 WIP_OUT은 수불 화면에서 확인 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { transType: "FG_IN,FG_IN_CANCEL", limit: "1000" };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/inventory/product/transactions", { params });
      setData(mergeTransactions(extractTransactions(res)));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo(() => createProductReceiveGridColumns({ t }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackageCheck className="w-7 h-7 text-primary" />
            {t("productMgmt.receive.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productMgmt.receive.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 본문: 좌측 입고이력 + 우측 작업 패널 */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* 좌측: 입고 이력 */}
        <Card className="flex-1 min-w-0 flex flex-col overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("productMgmt.receive.title")}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("common.search")}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <DateRangeFilter
                    from={fromDate}
                    to={toDate}
                    onFromChange={setFromDate}
                    onToChange={setToDate}
                    className="flex-shrink-0"
                  />
                </div>
              }
              sqlQuery={`SELECT *\nFROM PRODUCT_TRANSACTIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND TRANS_TYPE IN ('FG_IN', 'FG_IN_CANCEL')\nORDER BY TRANS_DATE DESC`}
            />
          </CardContent>
        </Card>

        {/* 우측: 스캔/입고 작업 패널 */}
        <Card className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden" padding="none">
          <ReceivablePanel onReceived={fetchData} />
        </Card>
      </div>
    </div>
  );
}
