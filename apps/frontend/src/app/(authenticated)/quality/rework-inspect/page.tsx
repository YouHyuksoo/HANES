"use client";

/**
 * @file src/app/(authenticated)/quality/rework-inspect/page.tsx
 * @description 재작업 후 검사 페이지 - IATF 16949 재작업 완료 건 재검증 검사 실적 입력
 *
 * 초보자 가이드:
 * 1. **재검사 대기 목록**: status=INSPECT_PENDING 인 ReworkOrder 조회
 * 2. **우측 패널**: 행 선택 시 InspectFormPanel에서 검사 실적 입력
 * 3. **StatCard**: 재검사대기 건수, 합격 건수, 불합격 건수
 * 4. API: GET /quality/reworks?status=INSPECT_PENDING, POST /quality/reworks/inspects
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, ClipboardCheck, Search } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import InspectFormPanel from "./components/InspectFormPanel";
import type { InspectTarget } from "./components/InspectFormPanel";
import { createReworkInspectGridColumns } from "./reworkInspectColumns";
import type { ReworkOrder } from "./types";

export default function ReworkInspectPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ReworkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<InspectTarget | null>(null);

  /* ── 목록 조회 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { status: "INSPECT_PENDING", limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/quality/reworks", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 행 선택 → 패널 열기 ── */
  const openPanel = useCallback((row: ReworkOrder) => {
    setSelectedTarget({
      reworkNo: row.reworkNo,
      itemCode: row.itemCode,
      reworkQty: row.reworkQty,
      resultQty: row.resultQty,
    });
  }, []);

  const handleSave = useCallback(() => {
    setSelectedTarget(null);
    fetchData();
  }, [fetchData]);

  const columns = useMemo(() => createReworkInspectGridColumns({
    t,
    onOpenInspectPanel: openPanel,
  }), [t, openPanel]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-primary" />{t("quality.rework.inspectTitle")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.rework.inspectSubtitle")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.rework.inspectTitle")}
            getRowId={row => (row as ReworkOrder).reworkNo}
            selectedRowId={selectedTarget?.reworkNo}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0">
                <div className="flex-1 min-w-[200px]">
                  <Input placeholder={t("common.search")} value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM REWORK_INSPECTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {/* 우측 패널: 검사 입력 */}
      {selectedTarget && (
        <InspectFormPanel target={selectedTarget}
          onClose={() => setSelectedTarget(null)}
          onSave={handleSave} />
      )}
    </div>
  );
}
