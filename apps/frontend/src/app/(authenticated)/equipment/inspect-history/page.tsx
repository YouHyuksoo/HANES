"use client";

/**
 * @file src/app/(authenticated)/equipment/inspect-history/page.tsx
 * @description 점검이력조회 페이지 - 일상/정기 점검 이력 통합 조회 (조회 전용)
 *
 * 초보자 가이드:
 * 1. **통합 조회**: 일상점검 + 정기점검 이력을 하나의 화면에서 조회
 * 2. **필터링**: 점검유형, 결과, 날짜 범위 등으로 필터링
 * 3. **조회 전용**: 등록/수정/삭제 없음
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ScrollText, Search, RefreshCw, Download, Calendar,
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";

interface InspectHistory {
  id: string;
  equipCode: string;
  equipName: string;
  inspectType: string;
  inspectDate: string;
  inspectorName: string;
  overallResult: string;
  remark: string;
}

const typeLabels: Record<string, string> = { DAILY: "일상", PERIODIC: "정기" };
const typeColors: Record<string, string> = {
  DAILY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PERIODIC: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};
const resultLabels: Record<string, string> = { PASS: "합격", FAIL: "불합격", CONDITIONAL: "조건부" };
const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  CONDITIONAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

const mockData: InspectHistory[] = [
  { id: "1", equipCode: "CUT-001", equipName: "절단기 1호", inspectType: "DAILY", inspectDate: "2025-02-01", inspectorName: "김점검", overallResult: "PASS", remark: "" },
  { id: "2", equipCode: "CRM-002", equipName: "압착기 2호", inspectType: "DAILY", inspectDate: "2025-02-01", inspectorName: "이점검", overallResult: "FAIL", remark: "압착 압력 부족" },
  { id: "3", equipCode: "CUT-001", equipName: "절단기 1호", inspectType: "PERIODIC", inspectDate: "2025-01-15", inspectorName: "김정비", overallResult: "PASS", remark: "월간 정기점검" },
  { id: "4", equipCode: "CRM-001", equipName: "압착기 1호", inspectType: "PERIODIC", inspectDate: "2025-01-15", inspectorName: "이정비", overallResult: "CONDITIONAL", remark: "실린더 마모" },
  { id: "5", equipCode: "ASM-001", equipName: "조립기 1호", inspectType: "DAILY", inspectDate: "2025-01-31", inspectorName: "박점검", overallResult: "PASS", remark: "" },
  { id: "6", equipCode: "INS-001", equipName: "검사기 1호", inspectType: "PERIODIC", inspectDate: "2025-01-10", inspectorName: "김정비", overallResult: "FAIL", remark: "센서 교정 필요" },
];

function InspectHistoryPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const typeOptions = [{ value: "", label: "전체 유형" }, { value: "DAILY", label: "일상점검" }, { value: "PERIODIC", label: "정기점검" }];
  const resultOptions = [{ value: "", label: "전체 결과" }, { value: "PASS", label: "합격" }, { value: "FAIL", label: "불합격" }, { value: "CONDITIONAL", label: "조건부" }];

  const filteredData = useMemo(() => mockData.filter((item) => {
    const matchSearch = !searchText || item.equipCode.toLowerCase().includes(searchText.toLowerCase()) || item.equipName.toLowerCase().includes(searchText.toLowerCase());
    const matchType = !typeFilter || item.inspectType === typeFilter;
    const matchResult = !resultFilter || item.overallResult === resultFilter;
    const matchDateFrom = !dateFrom || item.inspectDate >= dateFrom;
    const matchDateTo = !dateTo || item.inspectDate <= dateTo;
    return matchSearch && matchType && matchResult && matchDateFrom && matchDateTo;
  }), [searchText, typeFilter, resultFilter, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total: mockData.length, pass: mockData.filter((d) => d.overallResult === "PASS").length,
    fail: mockData.filter((d) => d.overallResult === "FAIL").length,
    conditional: mockData.filter((d) => d.overallResult === "CONDITIONAL").length,
  }), []);

  const columns = useMemo<ColumnDef<InspectHistory>[]>(() => [
    { accessorKey: "inspectDate", header: "점검일", size: 100 },
    { accessorKey: "inspectType", header: "유형", size: 70, cell: ({ getValue }) => { const v = getValue() as string; return <span className={`px-2 py-0.5 text-xs rounded-full ${typeColors[v] || ""}`}>{typeLabels[v]}</span>; } },
    { accessorKey: "equipCode", header: "설비코드", size: 100 },
    { accessorKey: "equipName", header: "설비명", size: 120 },
    { accessorKey: "inspectorName", header: "점검자", size: 80 },
    { accessorKey: "overallResult", header: "결과", size: 80, cell: ({ getValue }) => { const r = getValue() as string; return <span className={`px-2 py-0.5 text-xs rounded-full ${resultColors[r] || ""}`}>{resultLabels[r]}</span>; } },
    { accessorKey: "remark", header: t("common.remark"), size: 180 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ScrollText className="w-7 h-7 text-primary" />점검이력조회</h1>
          <p className="text-text-muted mt-1">일상/정기 점검 이력을 통합 조회합니다.</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />엑셀 다운로드</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="전체 점검" value={stats.total} icon={ClipboardCheck} color="blue" />
        <StatCard label="합격" value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label="불합격" value={stats.fail} icon={XCircle} color="red" />
        <StatCard label="조건부" value={stats.conditional} icon={AlertTriangle} color="yellow" />
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder="설비코드 / 설비명 검색" value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-32"><Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} fullWidth /></div>
          <div className="w-32"><Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth /></div>
          <div className="flex items-center gap-1"><Calendar className="w-4 h-4 text-text-muted" /><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" /></div>
          <span className="text-text-muted self-center">~</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default InspectHistoryPage;
