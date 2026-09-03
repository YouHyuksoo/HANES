"use client";

/**
 * @file src/app/(authenticated)/master/validation/page.tsx
 * @description 기준정보검증 페이지 - 마스터 데이터 언매칭/잠재 오류 전수 검사
 *
 * 초보자 가이드:
 * 1. 상단에서 검증 카테고리를 고르고 [검증 실행]을 누른다
 * 2. 요약 카드에 ERROR/WARN/규칙실패 건수가 표시된다
 * 3. 규칙 그리드에서 행을 클릭하면 하단에 위반 상세가 열린다
 * 4. 위반 행의 키 복사 후 [화면이동]으로 해당 마스터 화면에서 검색/수정한다
 */
import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Play, RefreshCw, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, Button } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";

type RuleCategory = "REF_INTEGRITY" | "INACTIVE_REF" | "DATA_QUALITY" | "BIZ_REVERSE_REF" | "TXN_INVARIANT";
type RuleSeverity = "ERROR" | "WARN";

interface RuleMeta {
  id: string;
  category: RuleCategory;
  severity: RuleSeverity;
  title: string;
  description: string;
  targetPath: string;
}

interface RuleRunResult {
  rule: RuleMeta;
  status: "OK" | "VIOLATION" | "ERROR";
  totalCount: number;
  rows: Record<string, unknown>[];
  errorMessage?: string;
}

interface RunResponse {
  runAt: string;
  durationMs: number;
  summary: {
    totalRules: number;
    failedRules: number;
    errorCount: number;
    warnCount: number;
  };
  results: RuleRunResult[];
}

const ALL_CATEGORIES: RuleCategory[] = [
  "REF_INTEGRITY",
  "INACTIVE_REF",
  "DATA_QUALITY",
  "BIZ_REVERSE_REF",
  "TXN_INVARIANT",
];

export default function MasterValidationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  usePageAiTools("master.validation");

  const [categories, setCategories] = useState<RuleCategory[]>(ALL_CATEGORIES);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [showOk, setShowOk] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleCategory = (c: RuleCategory) => {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const runValidation = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    setSelectedRuleId(null);
    try {
      const body =
        categories.length === ALL_CATEGORIES.length ? {} : { categories };
      const res = await api.post("/master/validation/run", body);
      setRunResult(res.data?.data ?? null);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [categories]);

  const visibleResults = useMemo(() => {
    if (!runResult) return [];
    if (showOk) return runResult.results;
    return runResult.results.filter((r) => r.status !== "OK");
  }, [runResult, showOk]);

  const selectedRule = useMemo(
    () => runResult?.results.find((r) => r.rule.id === selectedRuleId) ?? null,
    [runResult, selectedRuleId],
  );

  /** 위반 상세 그리드 컬럼 — 첫 행의 키로 동적 생성 */
  const detailColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!selectedRule || selectedRule.rows.length === 0) return [];
    const keys = Object.keys(selectedRule.rows[0]);
    const cols: ColumnDef<Record<string, unknown>>[] = keys.map((k) => ({
      accessorKey: k,
      header: k,
      size: k === "REF_KEY" ? 260 : 140,
    }));
    cols.push({
      id: "actions",
      header: "",
      size: 150,
      cell: ({ row }) => {
        const refKey = String(row.original.REF_KEY ?? "");
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(refKey);
                setCopiedKey(refKey);
                setTimeout(() => setCopiedKey(null), 1500);
              }}
              title={t("validation.copyKey")}
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedKey === refKey ? t("validation.copied") : null}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(selectedRule.rule.targetPath);
              }}
              title={t("validation.goToScreen")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    });
    return cols;
  }, [selectedRule, copiedKey, router, t]);

  const ruleColumns = useMemo<ColumnDef<RuleRunResult>[]>(
    () => [
      {
        accessorKey: "rule.category",
        header: t("validation.col.category"),
        size: 140,
        cell: ({ row }) => t(`validation.category.${row.original.rule.category}`),
      },
      {
        accessorKey: "rule.severity",
        header: t("validation.col.severity"),
        size: 80,
        cell: ({ row }) =>
          row.original.rule.severity === "ERROR" ? (
            <span className="text-red-600 font-semibold">ERROR</span>
          ) : (
            <span className="text-amber-600 font-semibold">WARN</span>
          ),
      },
      { accessorKey: "rule.id", header: t("validation.col.ruleId"), size: 130 },
      { accessorKey: "rule.title", header: t("validation.col.ruleName"), size: 240 },
      {
        accessorKey: "totalCount",
        header: t("validation.col.count"),
        size: 90,
        meta: { align: "right" as const },
      },
      {
        accessorKey: "status",
        header: t("validation.col.status"),
        size: 100,
        cell: ({ row }) => t(`validation.status.${row.original.status}`),
      },
    ],
    [t],
  );

  const violatedRules = runResult
    ? runResult.results.filter((r) => r.status === "VIOLATION").length
    : 0;

  const summaryStats: { label: string; value: number; className: string }[] = runResult
    ? [
        { label: t("validation.summary.errors"), value: runResult.summary.errorCount, className: "text-red-600" },
        { label: t("validation.summary.warns"), value: runResult.summary.warnCount, className: "text-amber-600" },
        { label: t("validation.summary.violatedRules"), value: violatedRules, className: "text-text" },
        { label: t("validation.summary.failedRules"), value: runResult.summary.failedRules, className: "text-text-muted" },
      ]
    : [];

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
      {/* 헤더 한 줄: 제목 + 카테고리 + 실행 + 요약 수치 */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h1 className="text-lg font-semibold">{t("validation.title")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ALL_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={categories.includes(c)}
                onChange={() => toggleCategory(c)}
              />
              {t(`validation.category.${c}`)}
            </label>
          ))}
        </div>
        <Button size="sm" onClick={runValidation} disabled={running || categories.length === 0}>
          {running ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? t("validation.running") : t("validation.run")}
        </Button>
        {runResult && (
          <>
            <div className="flex items-center divide-x divide-border rounded-md border border-border text-sm">
              {summaryStats.map((s) => (
                <div key={s.label} className="flex items-baseline gap-1.5 px-3 py-1">
                  <span className="text-xs text-text-muted">{s.label}</span>
                  <span className={`font-data text-base font-bold leading-none ${s.className}`}>{s.value}</span>
                </div>
              ))}
            </div>
            <span className="text-xs text-text-muted">
              {t("validation.lastRun")}: {new Date(runResult.runAt).toLocaleString()} (
              {runResult.durationMs}ms)
            </span>
          </>
        )}
      </div>

      {runError && (
        <div className="flex-shrink-0 rounded border border-red-500 px-3 py-2 text-sm text-red-600">
          {runError}
        </div>
      )}

      {!runResult && !running && (
        <div className="py-16 text-center text-sm text-text-muted">
          {t("validation.empty.prompt")}
        </div>
      )}

      {/* 규칙 결과 그리드 — 남은 높이를 채우고 내부 스크롤 */}
      {runResult && (
        <Card padding="none" className={selectedRule ? "flex min-h-0 flex-[3] flex-col" : "flex min-h-0 flex-1 flex-col"}>
          <CardContent className="flex h-full min-h-0 flex-col p-3">
            <label className="mb-2 flex flex-shrink-0 items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={showOk}
                onChange={(e) => setShowOk(e.target.checked)}
              />
              {t("validation.showOkRules")}
            </label>
            <div className="min-h-0 flex-1">
              <DataGrid
                data={visibleResults}
                columns={ruleColumns}
                isLoading={running}
                emptyMessage={t("validation.empty.noViolation")}
                onRowClick={(row) =>
                  setSelectedRuleId(row.rule.id === selectedRuleId ? null : row.rule.id)
                }
                selectedRowId={selectedRuleId ?? undefined}
                getRowId={(row) => row.rule.id}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 위반 상세 — 하단 분할, 내부 스크롤 */}
      {selectedRule && (
        <Card padding="none" className="flex min-h-0 flex-[2] flex-col">
          <CardContent className="flex h-full min-h-0 flex-col p-3">
            <div className="mb-2 flex-shrink-0 text-sm">
              <span className="font-semibold">
                [{selectedRule.rule.id}] {selectedRule.rule.title}
              </span>
              <span className="ml-2 text-text-muted">{selectedRule.rule.description}</span>
              {selectedRule.status === "ERROR" && (
                <div className="mt-1 text-red-600">{selectedRule.errorMessage}</div>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <DataGrid
                data={selectedRule.rows}
                columns={detailColumns}
                emptyMessage={t("validation.empty.noRows")}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
