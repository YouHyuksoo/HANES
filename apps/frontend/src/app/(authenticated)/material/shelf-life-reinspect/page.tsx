"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FlaskConical, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface ReinspectHistoryItem {
  inspectDate: string;
  seq: number;
  matUid: string | null;
  itemCode: string;
  itemName?: string | null;
  result: string;
  retestRound: number | null;
  inspectorName?: string | null;
  remark?: string | null;
}

interface ReinspectForm {
  matUid: string;
  result: "PASS" | "FAIL";
  extendDays: string;
  inspectorName: string;
  remark: string;
}

function ShelfLifeReinspectContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialMatUid = searchParams.get("matUid") ?? "";

  const [form, setForm] = useState<ReinspectForm>({
    matUid: initialMatUid,
    result: "PASS",
    extendDays: "",
    inspectorName: "",
    remark: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<ReinspectHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/material/shelf-life/reinspect", { params: { limit: "1000" } });
      setHistory(res.data?.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // URL 파라미터 변경 시 form matUid 동기화
  useEffect(() => {
    if (initialMatUid) {
      setForm(f => ({ ...f, matUid: initialMatUid }));
    }
  }, [initialMatUid]);

  const handleSubmit = useCallback(async () => {
    if (!form.matUid.trim()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        matUid: form.matUid.trim(),
        result: form.result,
        inspectorName: form.inspectorName || undefined,
        remark: form.remark || undefined,
      };
      if (form.result === "PASS" && form.extendDays) {
        payload.extendDays = Number(form.extendDays);
      }
      await api.post("/material/shelf-life/reinspect", payload);
      setForm({ matUid: "", result: "PASS", extendDays: "", inspectorName: "", remark: "" });
      fetchHistory();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSubmitting(false);
    }
  }, [form, fetchHistory]);

  const historyColumns = useMemo<ColumnDef<ReinspectHistoryItem>[]>(() => [
    {
      accessorKey: "inspectDate", header: t("common.date"), size: 120,
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
    },
    {
      accessorKey: "matUid", header: "LOT No.", size: 170,
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
    },
    {
      accessorKey: "retestRound", header: t("material.shelfLife.retestRound"), size: 70,
      meta: { align: "center" as const },
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as number) ?? "-"}</span>,
    },
    {
      accessorKey: "result", header: t("common.result", "결과"), size: 80,
      meta: { align: "center" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const cls = v === "PASS"
          ? "text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700"
          : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300";
        const label = v === "PASS" ? t("material.shelfLife.pass") : t("material.shelfLife.fail");
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
      },
    },
    {
      accessorKey: "inspectorName", header: t("quality.iqcHistory.inspectorName", "검사자"), size: 100,
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 160,
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-primary" />
            {t("material.shelfLife.reinspectTitle")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.shelfLife.reinspectSubtitle", "유수명자재 재검사 결과를 등록하고 이력을 조회합니다.")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHistory}>
          <RefreshCw className={`w-4 h-4 mr-1 ${historyLoading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 재검사 등록 폼 */}
      <Card className="flex-shrink-0" padding="none">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-text mb-4 flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4 text-primary" />
            {t("common.register")} — {t("material.shelfLife.reinspect")}
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
            {/* LOT No. */}
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs font-medium text-text-muted block mb-1">LOT No. *</label>
              <Input
                value={form.matUid}
                onChange={e => setForm(f => ({ ...f, matUid: e.target.value }))}
                placeholder="VH1-RM..."
                fullWidth
              />
            </div>

            {/* 결과 */}
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">{t("common.result", "결과")} *</label>
              <div className="flex gap-2 h-9">
                {(["PASS", "FAIL"] as const).map(r => (
                  <button key={r} onClick={() => setForm(f => ({ ...f, result: r }))}
                    className={`flex-1 rounded text-sm font-medium border transition-colors flex items-center justify-center gap-1 ${
                      form.result === r
                        ? r === "PASS"
                          ? "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300"
                          : "bg-red-100 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300"
                        : "border-border text-text-muted hover:bg-surface-secondary"
                    }`}>
                    {r === "PASS"
                      ? <><CheckCircle className="w-3.5 h-3.5" />{t("material.shelfLife.pass")}</>
                      : <><XCircle className="w-3.5 h-3.5" />{t("material.shelfLife.fail")}</>}
                  </button>
                ))}
              </div>
            </div>

            {/* 연장일 (PASS만) */}
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">
                {t("material.shelfLife.extendDays")}
              </label>
              <Input
                type="number"
                min={0}
                value={form.result === "PASS" ? form.extendDays : ""}
                onChange={e => setForm(f => ({ ...f, extendDays: e.target.value }))}
                placeholder={form.result === "PASS" ? "품목 기준 자동" : "-"}
                disabled={form.result !== "PASS"}
                fullWidth
              />
            </div>

            {/* 검사자 */}
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1">
                {t("quality.iqcHistory.inspectorName", "검사자")}
              </label>
              <Input
                value={form.inspectorName}
                onChange={e => setForm(f => ({ ...f, inspectorName: e.target.value }))}
                fullWidth
              />
            </div>

            {/* 비고 */}
            <div className="col-span-2 md:col-span-3">
              <label className="text-xs font-medium text-text-muted block mb-1">{t("common.remark")}</label>
              <Input
                value={form.remark}
                onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                fullWidth
              />
            </div>

            {/* 등록 버튼 */}
            <div className="flex items-end">
              <Button className="w-full" onClick={handleSubmit}
                disabled={submitting || !form.matUid.trim()}>
                {submitting ? t("common.saving") : t("common.register")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 재검사 이력 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={history}
            columns={historyColumns}
            isLoading={historyLoading}
            enableColumnFilter
            enableExport
            exportFileName={t("material.shelfLife.reinspectHistory")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ShelfLifeReinspectPage() {
  return (
    <Suspense>
      <ShelfLifeReinspectContent />
    </Suspense>
  );
}
