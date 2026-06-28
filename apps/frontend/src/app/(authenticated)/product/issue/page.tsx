"use client";

/**
 * @file src/app/(authenticated)/product/issue/page.tsx
 * @description 제품출고관리 페이지 - 반제품/완제품 출고 처리 (폐기, 창고이동, 기타)
 *
 * 초보자 가이드:
 * 1. 출고 이력 DataGrid: WIP_OUT, FG_OUT, WIP_OUT_CANCEL, FG_OUT_CANCEL 조회
 * 2. 출고등록 우측 패널: 품목유형(WIP/FG) 선택 → 재고에서 품목 선택 → 출고계정(ISSUE_TYPE) 필수
 * 3. StatCards: 금일 출고건수/수량, WIP/FG 출고 건수
 * 4. API: POST /inventory/wip/issue 또는 POST /inventory/fg/issue
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  PackageX, RefreshCw, Search, Hash, Package, ClipboardPlus,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import IssueFormPanel, { IssueFormValues } from "./components/IssueFormPanel";
import { ProductIssueTx, createProductIssueGridColumns } from "./productIssueColumns";

export default function ProductIssuePage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductIssueTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [fromDate, setStartDate] = useState(() => getTodayLocal());
  const [toDate, setEndDate] = useState(() => getTodayLocal());

  /* 우측 패널 */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /** 출고 이력 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        transType: "WIP_OUT,FG_OUT,WIP_OUT_CANCEL,FG_OUT_CANCEL",
        limit: "5000",
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/inventory/product/transactions", { params });
      const list = res.data?.data ?? res.data;
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 출고 처리 */
  const handleSubmit = useCallback(async (formValues: IssueFormValues) => {
    setSaving(true);
    try {
      const endpoint = formValues.itemType === "SEMI_PRODUCT" ? "/inventory/wip/issue" : "/inventory/fg/issue";
      await api.post(endpoint, {
        itemCode: formValues.itemCode,
        warehouseCode: formValues.warehouseCode,
        qty: formValues.qty,
        itemType: formValues.itemType,
        transType: formValues.transType,
        issueType: formValues.issueType,
        remark: formValues.remark || undefined,
      });
      setIsPanelOpen(false);
      fetchData();
    } catch (e) {
      console.error("Issue failed:", e);
    } finally {
      setSaving(false);
    }
  }, [fetchData]);

  /** 통계 */
  const stats = useMemo(() => {
    const today = getTodayLocal();
    const todayDone = data.filter(
      (d) => (d.transType === "WIP_OUT" || d.transType === "FG_OUT") &&
        d.status === "DONE" && String(d.transDate).slice(0, 10) === today,
    );
    return {
      todayCount: todayDone.length,
      todayQty: todayDone.reduce((sum, d) => sum + Math.abs(d.qty), 0),
      wipCount: data.filter((d) => d.transType === "WIP_OUT" && d.status === "DONE").length,
      fgCount: data.filter((d) => d.transType === "FG_OUT" && d.status === "DONE").length,
    };
  }, [data]);

  const columns = useMemo(() => createProductIssueGridColumns({ t }), [t]);

  return (
    <div className="flex h-full animate-fade-in">
      {/* 메인 영역 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <PackageX className="w-7 h-7 text-primary" />
              {t("productMgmt.issue.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("productMgmt.issue.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => setIsPanelOpen(true)} disabled={isPanelOpen}>
              <ClipboardPlus className="w-4 h-4 mr-1" />
              {t("productMgmt.issue.registerIssue")}
            </Button>
          </div>
        </div>

        {/* StatCards */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <StatCard label={t("productMgmt.issue.stats.todayCount")} value={stats.todayCount} icon={Hash} color="blue" />
          <StatCard label={t("productMgmt.issue.stats.todayQty")} value={stats.todayQty} icon={Package} color="green" />
          <StatCard label={t("productMgmt.issue.stats.wipCount")} value={stats.wipCount} icon={PackageX} color="yellow" />
          <StatCard label={t("productMgmt.issue.stats.fgCount")} value={stats.fgCount} icon={PackageX} color="purple" />
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport
            exportFileName={t("productMgmt.issue.title")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("productMgmt.issueCancel.searchPlaceholder")}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
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
            sqlQuery={`SELECT *\nFROM PROD_ISSUES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {/* 우측 출고등록 패널 */}
      {isPanelOpen && (
        <IssueFormPanel
          onClose={() => setIsPanelOpen(false)}
          onSubmit={handleSubmit}
          loading={saving}
        />
      )}
    </div>
  );
}
