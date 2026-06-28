"use client";

/**
 * @file src/app/(authenticated)/production/sample-inspect/page.tsx
 * @description 반제품 샘플검사 페이지 - 이력 조회 + 신규 입력 기능
 *
 * 초보자 가이드:
 * 1. **이력 조회**: API 연동 샘플검사 이력 (날짜, 합불, 검색 필터)
 * 2. **신규 입력**: 모달에서 작업지시 선택 → 샘플별 측정값 입력
 * 3. **통계**: 총검사/합격/불합격/합격률 StatCard
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, FlaskConical, Plus } from "lucide-react";
import { Card, CardContent, Button, Input, Select } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import SampleInspectInputModal from "./components/SampleInspectInputModal";
import { createSampleInspectGridColumns, type SampleInspectRow } from "./sampleInspectColumns";

export default function SampleInspectPage() {
  const { t } = useTranslation();
  const comCodeJudgeOptions = useComCodeOptions("JUDGE_YN");

  const [data, setData] = useState<SampleInspectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [passFilter, setPassFilter] = useState("");
  const [fromDate, setStartDate] = useState(() => getTodayLocal());
  const [toDate, setEndDate] = useState(() => getTodayLocal());
  const [showInput, setShowInput] = useState(false);

  const passOptions = useMemo(() => [
    { value: "", label: t("production.sampleInspect.allJudgment") }, ...comCodeJudgeOptions,
  ], [t, comCodeJudgeOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (passFilter) params.passYn = passFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/production/sample-inspect-input", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, passFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo(() => createSampleInspectGridColumns({ t }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-primary" />
            {t("production.sampleInspect.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("production.sampleInspect.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={() => setShowInput(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("production.sampleInspect.inputBtn")}
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("production.sampleInspect.exportFileName", "샘플검사")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("production.sampleInspect.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={passOptions}
                  value={passFilter} onChange={setPassFilter} fullWidth />
              </div>
              <DateRangeFilter from={fromDate} to={toDate} onFromChange={setStartDate} onToChange={setEndDate} className="flex-shrink-0" />
            </div>
          } 
          sqlQuery={`SELECT *\nFROM SAMPLE_INSPECTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <SampleInspectInputModal isOpen={showInput} onClose={() => setShowInput(false)} onCreated={fetchData} />
    </div>
  );
}
