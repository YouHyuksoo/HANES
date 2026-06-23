"use client";

/**
 * @file src/app/(authenticated)/quality/self-inspect-history/page.tsx
 * @description 자주검사 이력 조회 페이지
 *
 * 초보자 가이드:
 * 1. 상단 필터로 기간/작업지시/공정 검색
 * 2. 좌측 목록에서 행 선택 → 우측에 작업지시 전체 결과 표시
 */
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { History, RefreshCw, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import { getTodayLocal } from "@/utils/date";
import type { SelectOption } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface HistoryRecord {
  id: string;
  orderNo: string;
  processCode: string | null;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  measureValue: number | null;
  remark: string | null;
  sampleNo: number;
  createdAt: string;
}

interface DetailRecord {
  id: string;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  measureValue: number | null;
  remark: string | null;
  sampleNo: number;
  inspectedAt: string | null;
}

export default function SelfInspectHistoryPage() {
  const { t } = useTranslation();
  const today = getTodayLocal();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<HistoryRecord | null>(null);
  const [detail, setDetail] = useState<DetailRecord[]>([]);
  const [fromDate, setDateFrom] = useState(today);
  const [toDate, setDateTo] = useState(today);
  const [orderNo, setOrderNo] = useState("");
  const [processCode, setProcessCode] = useState("");
  const [processOptions, setProcessOptions] = useState<SelectOption[]>([]);

  const statusBadge = (status: string) => {
    if (status === "PASS")
      return <span className="px-1.5 py-0.5 rounded text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700">PASS</span>;
    if (status === "FAIL")
      return <span className="px-1.5 py-0.5 rounded text-xs font-bold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700">FAIL</span>;
    return <span className="px-1.5 py-0.5 rounded text-xs font-bold text-text-muted border border-border">PENDING</span>;
  };

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/self-inspect/history", {
        params: {
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          orderNo: orderNo || undefined,
          processCode: processCode || undefined,
          limit: 200,
        },
      });
      setRecords(res.data?.data ?? []);
      setSelected(null);
      setDetail([]);
    } catch {
      toast.error(t("common.loadError", "조회 중 오류"));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, orderNo, processCode, t]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    api.get("/master/processes", { params: { limit: 100 } })
      .then(res => {
        const list: SelectOption[] = (res.data?.data ?? []).map(
          (p: { processCode: string; processName: string }) => ({
            value: p.processCode,
            label: `${p.processCode} - ${p.processName}`,
          })
        );
        setProcessOptions(list);
      })
      .catch(() => {});
  }, []);

  const handleSelect = useCallback(async (record: HistoryRecord) => {
    setSelected(record);
    try {
      const res = await api.get(`/production/self-inspect/results/${record.orderNo}`);
      setDetail(res.data?.data ?? []);
    } catch {
      setDetail([]);
    }
  }, []);

  const columns: ColumnDef<HistoryRecord, unknown>[] = [
    { accessorKey: "orderNo", header: t("selfInspectHistory.orderNo", "작업지시"), size: 140 },
    { accessorKey: "processCode", header: t("selfInspectHistory.processCode", "공정"), size: 90 },
    { accessorKey: "itemName", header: t("selfInspectHistory.itemName", "항목명"), size: 160 },
    {
      accessorKey: "timing",
      header: t("selfInspectHistory.timing", "시점"),
      size: 60,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST"
          ? t("selfInspectHistory.timingFirst", "초물")
          : v === "MID"
            ? t("selfInspectHistory.timingMid", "중물")
            : t("selfInspectHistory.timingLast", "종물");
      },
    },
    {
      accessorKey: "status",
      header: t("selfInspectHistory.status", "결과"),
      size: 70,
      cell: ({ getValue }) => statusBadge(getValue<string>()),
    },
    {
      accessorKey: "createdAt",
      header: t("selfInspectHistory.createdAt", "등록일시"),
      size: 130,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(v).toLocaleString() : "-";
      },
    },
  ];

  const detailColumns: ColumnDef<DetailRecord, unknown>[] = [
    { accessorKey: "itemName", header: t("selfInspectHistory.itemName", "항목명"), size: 160 },
    {
      accessorKey: "timing",
      header: t("selfInspectHistory.timing", "시점"),
      size: 55,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST"
          ? t("selfInspectHistory.timingFirst", "초물")
          : v === "MID"
            ? t("selfInspectHistory.timingMid", "중물")
            : t("selfInspectHistory.timingLast", "종물");
      },
    },
    { accessorKey: "sampleNo", header: t("selfInspectHistory.sampleNo", "시료번호"), size: 65 },
    {
      accessorKey: "measureValue",
      header: t("selfInspectHistory.measureValue", "측정값"),
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v != null ? v : "-";
      },
    },
    {
      accessorKey: "status",
      header: t("selfInspectHistory.status", "결과"),
      size: 70,
      cell: ({ getValue }) => statusBadge(getValue<string>()),
    },
    { accessorKey: "remark", header: t("selfInspectHistory.remark", "비고"), size: 150 },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-gray-100 flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            {t("selfInspectHistory.title", "공정샘플검사 이력")}
          </h1>
          <p className="text-sm text-text-muted dark:text-gray-400 mt-0.5">
            {t("selfInspectHistory.subtitle", "공정샘플검사 결과 이력을 조회합니다")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHistory}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 필터 영역 */}
      <div className="flex gap-2 flex-shrink-0 flex-wrap">
        <DateRangeFilter
          from={fromDate}
          to={toDate}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          className="flex-shrink-0"
        />
        <Input
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder={t("selfInspectHistory.orderNo", "작업지시번호")}
          className="w-44 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") fetchHistory(); }}
        />
        <Select
          value={processCode}
          onChange={setProcessCode}
          options={processOptions}
          placeholder={t("selfInspectHistory.processCode", "전체 공정")}
          className="w-52 text-sm"
        />
        <Button size="sm" onClick={fetchHistory}>
          <Search className="w-4 h-4 mr-1" />
          {t("common.search")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 min-h-0 flex-1">
        {/* 좌측: 이력 목록 */}
        <div className="col-span-5 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-3">
              <p className="text-xs font-semibold text-text-muted mb-2 shrink-0">
                {t("selfInspectHistory.resultList", "검사 이력")} ({records.length})
              </p>
              <div className="flex-1 min-h-0">
                <DataGrid
                  data={records}
                  columns={columns}
                  isLoading={loading}
                  selectedRowId={selected?.id}
                  getRowId={(row) => row.id}
                  onRowClick={handleSelect}
                  maxHeight="100%"
                  enableColumnFilter={false}

                sqlQuery={`SELECT *\nFROM SELF_INSPECT_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 우측: 상세 */}
        <div className="col-span-7 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4 gap-3">
              {!selected ? (
                <div className="flex items-center justify-center h-full text-text-muted dark:text-gray-400 text-sm">
                  {t("selfInspectHistory.selectHint", "좌측에서 이력을 선택하세요")}
                </div>
              ) : (
                <>
                  <div className="shrink-0">
                    <p className="text-xs text-text-muted">
                      {t("selfInspectHistory.orderNo", "작업지시")}: <span className="font-mono text-text dark:text-gray-200">{selected.orderNo}</span>
                    </p>
                  </div>
                  <div className="flex-1 min-h-0">
                    <DataGrid
                      data={detail}
                      columns={detailColumns}
                      getRowId={(row) => row.id}
                      maxHeight="100%"
                      enableColumnFilter={false}

                    sqlQuery={`SELECT *\nFROM SELF_INSPECT_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND ORDER_NO = '${selected.orderNo}'\nORDER BY TIMING, SAMPLE_NO`}/>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
