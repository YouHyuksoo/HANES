"use client";

/**
 * @file src/app/(authenticated)/material/misc-receipt/page.tsx
 * @description 기타입고 페이지 - PO 없는 기타 사유 입고 처리
 *
 * 초보자 가이드:
 * 1. **기타입고**: 정규 발주 외 입고 (반품, 무상공급, 테스트용 등)
 * 2. **StockTransaction**: MISC_IN 유형으로 기록
 * 3. API: GET /material/misc-receipt, POST /material/misc-receipt
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PackagePlus, Search, RefreshCw, Plus } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createMiscReceiptGridColumns, MiscReceiptRecord } from "./miscReceiptColumns";
import MiscReceiptRegisterPanel from "./components/MiscReceiptRegisterPanel";

export default function MiscReceiptPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<MiscReceiptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(() => getTodayLocal());
  const [endDate, setEndDate] = useState(() => getTodayLocal());
  const [showRegister, setShowRegister] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (startDate) params.fromDate = startDate;
      if (endDate) params.toDate = endDate;
      const res = await api.get("/material/misc-receipt", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRegistered = useCallback(() => {
    setShowRegister(false);
    fetchData();
  }, [fetchData]);

  const columns = useMemo(() => createMiscReceiptGridColumns({ t }), [t]);

  return (
    <div className="h-full flex overflow-hidden animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-3">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <PackagePlus className="w-7 h-7 text-primary" />
              {t("material.miscReceipt.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("material.miscReceipt.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => setShowRegister(true)}>
              <Plus className="w-4 h-4 mr-1" />{t("material.miscReceipt.register")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.miscReceipt.title")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("material.miscReceipt.searchPlaceholder")}
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <DateRangeFilter
                  from={startDate}
                  to={endDate}
                  onFromChange={setStartDate}
                  onToChange={setEndDate}
                  className="flex-shrink-0"
                />
              </div>
            }
            sqlQuery={`SELECT *\nFROM MAT_MISC_RECEIPTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {showRegister && (
        <MiscReceiptRegisterPanel
          onClose={() => setShowRegister(false)}
          onSuccess={handleRegistered}
        />
      )}
    </div>
  );
}
