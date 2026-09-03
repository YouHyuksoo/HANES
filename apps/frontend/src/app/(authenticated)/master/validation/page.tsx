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
import { Card, CardContent, Button, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";

type RuleCategory = "REF_INTEGRITY" | "INACTIVE_REF" | "DATA_QUALITY" | "BIZ_REVERSE_REF";
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

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 헤더: 카테고리 선택 + 실행 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h1 className="text-lg font-semibold">{t("validation.title")}</h1>
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
          <Button onClick={runValidation} disabled={running || categories.length === 0}>
            {running ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? t("validation.running") : t("validation.run")}
          </Button>
          {runResult && (
            <span className="text-xs text-muted-foreground">
              {t("validation.lastRun")}: {new Date(runResult.runAt).toLocaleString()} (
              {runResult.durationMs}ms)
            </span>
          )}
        </CardContent>
      </Card>

      {runError && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {runError}
        </div>
      )}

      {/* 요약 카드 */}
      {runResult && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t("validation.summary.errors")} value={runResult.summary.errorCount} icon={ShieldCheck} color="red" />
          <StatCard label={t("validation.summary.warns")} value={runResult.summary.warnCount} icon={ShieldCheck} color="orange" />
          <StatCard label={t("validation.summary.violatedRules")} value={violatedRules} icon={ShieldCheck} color="yellow" />
          <StatCard label={t("validation.summary.failedRules")} value={runResult.summary.failedRules} icon={ShieldCheck} color="gray" />
        </div>
      )}

      {/* 규칙 결과 그리드 */}
      {runResult && (
        <Card>
          <CardContent className="py-3">
            <div className="mb-2 flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={showOk}
                  onChange={(e) => setShowOk(e.target.checked)}
                />
                {t("validation.showOkRules")}
              </label>
            </div>
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
              maxHeight="calc(100vh - 480px)"
            />
          </CardContent>
        </Card>
      )}

      {!runResult && !running && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {t("validation.empty.prompt")}
        </div>
      )}

      {/* 위반 상세 */}
      {selectedRule && (
        <Card>
          <CardContent className="py-3">
            <div className="mb-2">
              <span className="font-semibold">
                [{selectedRule.rule.id}] {selectedRule.rule.title}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                {selectedRule.rule.description}
              </span>
              {selectedRule.status === "ERROR" && (
                <div className="mt-1 text-sm text-red-600">{selectedRule.errorMessage}</div>
              )}
            </div>
            <DataGrid
              data={selectedRule.rows}
              columns={detailColumns}
              emptyMessage={t("validation.empty.noRows")}
              maxHeight="320px"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
