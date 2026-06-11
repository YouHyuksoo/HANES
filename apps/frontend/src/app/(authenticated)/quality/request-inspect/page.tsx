"use client";

/**
 * @file src/app/(authenticated)/quality/request-inspect/page.tsx
 * @description 의뢰검사 입력 페이지 — DELEGATE 방식 자주검사 결과 입력
 *
 * 초보자 가이드:
 * 1. 좌측: 의뢰검사 대기(PENDING) 목록 조회
 * 2. 우측: 선택 항목의 측정값/판정 입력
 * 3. 저장: PATCH /production/self-inspect/results/:id/status
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, CardContent } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface DelegateItem {
  id: string;
  orderNo: string;
  processCode: string | null;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  remark: string | null;
  measureValue: number | null;
  sampleNo: number;
  createdAt: string;
}

export default function RequestInspectPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<DelegateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DelegateItem | null>(null);
  const [measureValue, setMeasureValue] = useState("");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDelegates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/self-inspect/delegates");
      setItems(res.data?.data ?? []);
    } catch {
      toast.error(t("common.loadError", "조회 중 오류"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDelegates();
  }, [fetchDelegates]);

  const handleSelect = (item: DelegateItem) => {
    setSelected(item);
    setMeasureValue(item.measureValue != null ? String(item.measureValue) : "");
    setRemark(item.remark ?? "");
  };

  const handleSubmit = useCallback(
    async (status: "PASS" | "FAIL") => {
      if (!selected) return;
      setSubmitting(true);
      try {
        await api.patch(`/production/self-inspect/results/${selected.id}/status`, {
          status,
          remark: remark.trim() || undefined,
          measureValue: measureValue !== "" ? Number(measureValue) : undefined,
        });
        toast.success(
          status === "PASS"
            ? t("requestInspect.passSuccess", "합격 처리되었습니다")
            : t("requestInspect.failSuccess", "불합격 처리되었습니다")
        );
        setSelected(null);
        setMeasureValue("");
        setRemark("");
        fetchDelegates();
      } catch {
        toast.error(t("common.saveError", "처리 중 오류"));
      } finally {
        setSubmitting(false);
      }
    },
    [selected, remark, measureValue, t, fetchDelegates]
  );

  const columns: ColumnDef<DelegateItem, unknown>[] = [
    { accessorKey: "orderNo", header: t("requestInspect.orderNo", "작업지시"), size: 140 },
    { accessorKey: "processCode", header: t("requestInspect.processCode", "공정"), size: 90 },
    { accessorKey: "itemName", header: t("requestInspect.itemName", "항목명"), size: 180 },
    {
      accessorKey: "timing",
      header: t("requestInspect.timing", "시점"),
      size: 60,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST" ? "초물" : v === "MID" ? "중물" : "종물";
      },
    },
    {
      accessorKey: "createdAt",
      header: t("requestInspect.requestedAt", "요청일시"),
      size: 140,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(v).toLocaleString("ko-KR") : "-";
      },
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-gray-100 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            {t("requestInspect.title", "의뢰검사 입력")}
          </h1>
          <p className="text-sm text-text-muted dark:text-gray-400 mt-0.5">
            {t("requestInspect.subtitle", "의뢰검사 대기 항목의 결과를 입력합니다")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchDelegates}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 min-h-0 flex-1">
        {/* 좌측: 대기 목록 */}
        <div className="col-span-6 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-3">
              <p className="text-xs font-semibold text-text-muted mb-2 shrink-0">
                {t("requestInspect.pendingList", "의뢰검사 대기 목록")} ({items.length})
              </p>
              <div className="flex-1 min-h-0">
                <DataGrid
                  data={items}
                  columns={columns}
                  isLoading={loading}
                  selectedRowId={selected?.id}
                  getRowId={(row) => row.id}
                  onRowClick={handleSelect}
                  maxHeight="100%"
                  enableColumnFilter={false}
                
                sqlQuery={`SELECT *\nFROM INSPECT_REQUESTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 우측: 결과 입력 */}
        <div className="col-span-6 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col p-5 gap-4">
              {!selected ? (
                <div className="flex items-center justify-center h-full text-text-muted dark:text-gray-400 text-sm">
                  {t("requestInspect.selectHint", "좌측에서 항목을 선택하세요")}
                </div>
              ) : (
                <>
                  {/* 항목 정보 */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-text dark:text-gray-100">
                      {selected.itemName}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-text-muted">{t("requestInspect.orderNo", "작업지시")}: </span>
                        <span className="text-text dark:text-gray-200 font-mono">{selected.orderNo}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">{t("requestInspect.timing", "시점")}: </span>
                        <span className="text-text dark:text-gray-200">
                          {selected.timing === "FIRST" ? "초물" : selected.timing === "MID" ? "중물" : "종물"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 측정값 입력 */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">
                      {t("requestInspect.measureValue", "측정값")}
                    </label>
                    <input
                      type="number"
                      value={measureValue}
                      onChange={(e) => setMeasureValue(e.target.value)}
                      placeholder={t("requestInspect.measureValuePlaceholder", "측정값 입력 (선택)")}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text dark:text-gray-200 placeholder:text-text-muted dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* 비고 */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">
                      {t("requestInspect.remark", "비고")}
                    </label>
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder={t("requestInspect.remarkPlaceholder", "특이사항 입력 (선택)")}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text dark:text-gray-200 placeholder:text-text-muted dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  {/* 판정 버튼 */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSubmit("PASS")}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {t("requestInspect.pass", "합격 (PASS)")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit("FAIL")}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                      {t("requestInspect.fail", "불합격 (FAIL)")}
                    </button>
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
