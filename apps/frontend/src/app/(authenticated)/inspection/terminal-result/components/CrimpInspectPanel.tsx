"use client";

/**
 * @file inspection/terminal-result/components/CrimpInspectPanel.tsx
 * @description 절압물검사 입력 패널 — 선택한 압착 작업지시의 단자(BOM SIDE)별 실측값과 외관 판정을 등록한다.
 *
 * 초보자 가이드:
 * 1. /quality/crimp-inspect/context 가 단자별 압착 규격(TERMINAL_CRIMP_SPECS)과 외관 판정 항목을 내려준다.
 * 2. 규격에 상하한이 있는 항목만 입력칸이 생긴다. 입력하면 규격 안/밖을 바로 색으로 보여준다(최종 판정은 서버).
 * 3. 규격을 특정할 수 없는 단자가 있으면 등록 버튼을 막고 사유를 보여준다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle, RefreshCw, Save, XCircle } from "lucide-react";
import {
  CRIMP_INSPECT_TIMING_VALUES,
  crimpLimits,
  crimpMeasureTargets,
  isCrimpValueInSpec,
  type CrimpInspectTiming,
  type CrimpMeasureKey,
} from "@harness/shared";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { WorkerSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import type { CrimpInspectContext, CrimpInspectHistoryRow, CrimpOrderRow, CrimpSideStatus } from "../types";

type MeasureForm = Record<string, Partial<Record<CrimpMeasureKey, string>>>;

const MEASURE_LABEL_KEY: Record<CrimpMeasureKey, string> = {
  crimpHeight: "master.terminalCrimpSpec.crimpHeight",
  crimpWidth: "master.terminalCrimpSpec.crimpWidth",
  insCrimpHeight: "master.terminalCrimpSpec.insCrimpHeight",
  pullForce: "inspection.terminalResult.pullForce",
  stripLength: "master.terminalCrimpSpec.stripLength",
};

const TIMING_LABEL_KEY: Record<CrimpInspectTiming, string> = {
  FIRST: "selfInspect.timingFirst",
  MID: "selfInspect.timingMid",
  LAST: "selfInspect.timingLast",
};

function formatRange(lsl: number | null, usl: number | null): string {
  if (lsl !== null && usl !== null) return `${lsl} ~ ${usl}`;
  if (lsl !== null) return `≥ ${lsl}`;
  if (usl !== null) return `≤ ${usl}`;
  return "-";
}

function parseTiming(inspectData: string | null): CrimpInspectTiming | null {
  if (!inspectData) return null;
  try {
    const timing = (JSON.parse(inspectData) as { timing?: string }).timing;
    return (CRIMP_INSPECT_TIMING_VALUES as readonly string[]).includes(timing ?? "") ? (timing as CrimpInspectTiming) : null;
  } catch {
    return null;
  }
}

interface Props {
  order: CrimpOrderRow;
  onSaved: () => void;
}

export default function CrimpInspectPanel({ order, onSaved }: Props) {
  const { t } = useTranslation();
  const [context, setContext] = useState<CrimpInspectContext | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [history, setHistory] = useState<CrimpInspectHistoryRow[]>([]);
  const [timing, setTiming] = useState<CrimpInspectTiming>("FIRST");
  const [workerId, setWorkerId] = useState("");
  const [measures, setMeasures] = useState<MeasureForm>({});
  const [visual, setVisual] = useState<Record<string, "OK" | "NG">>({});
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<CrimpInspectHistoryRow | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const [ctxRes, histRes] = await Promise.all([
        api.get("/quality/crimp-inspect/context", { params: { orderNo: order.orderNo } }),
        api.get("/quality/crimp-inspect/history", { params: { orderNo: order.orderNo } }),
      ]);
      setContext(ctxRes.data?.data ?? null);
      setHistory(histRes.data?.data ?? []);
    } catch {
      setContext(null);
      setLoadFailed(true);
    }
  }, [order.orderNo]);

  useEffect(() => { void load(); }, [load]);

  const sideStatusMessage = useCallback((status: CrimpSideStatus) => {
    const fallback: Record<CrimpSideStatus, string> = {
      OK: "",
      NO_WIRE: "BOM에서 전선을 찾을 수 없습니다.",
      MULTI_WIRE: "BOM 전선이 2종 이상이라 특정할 수 없습니다.",
      NO_SPEC: "이 단자+전선 조합의 압착 규격이 없습니다.",
      DUP_SPEC: "이 단자+전선 조합의 압착 규격이 2건 이상입니다.",
    };
    return t(`inspection.terminalResult.sideStatus.${status}`, fallback[status]);
  }, [t]);

  /** 입력 완료 여부 — 규격 대상 측정값 전부 + 외관 판정 전부 + 검사자 */
  const complete = useMemo(() => {
    if (!context?.ready || !workerId) return false;
    const measuresDone = context.sides.every((side) =>
      crimpMeasureTargets(side.spec!).every((key) => (measures[side.sideKey]?.[key] ?? "").trim() !== ""),
    );
    return measuresDone && context.visualChecks.every((v) => visual[v.code]);
  }, [context, measures, visual, workerId]);

  /** 입력값 기준 예상 판정 (서버가 다시 판정한다) */
  const expectedPass = useMemo(() => {
    if (!complete || !context) return null;
    const specOk = context.sides.every((side) =>
      crimpMeasureTargets(side.spec!).every((key) => isCrimpValueInSpec(side.spec!, key, measures[side.sideKey]?.[key]) === true),
    );
    return specOk && context.visualChecks.every((v) => visual[v.code] === "OK");
  }, [complete, context, measures, visual]);

  const handleSave = async () => {
    if (!context || !complete) return;
    setSaving(true);
    try {
      const res = await api.post("/quality/crimp-inspect", {
        orderNo: order.orderNo,
        timing,
        workerId,
        sides: context.sides.map((side) => ({
          sideKey: side.sideKey,
          ...Object.fromEntries(
            crimpMeasureTargets(side.spec!).map((key) => [key, Number(measures[side.sideKey]?.[key])]),
          ),
        })),
        visualChecks: context.visualChecks.map((v) => ({ code: v.code, result: visual[v.code] })),
        remark: remark.trim() || undefined,
      });
      setLastResult(res.data?.data ?? null);
      setMeasures({});
      setVisual({});
      setRemark("");
      await load();
      onSaved();
    } catch {
      // 오류 안내는 공통 API 피드백 창이 띄운다
    } finally {
      setSaving(false);
    }
  };

  const historyColumns = useMemo<ColumnDef<CrimpInspectHistoryRow>[]>(() => [
    {
      accessorKey: "inspectAt", header: t("inspection.terminalResult.inspectedAt", "검사시간"), size: 130,
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    },
    {
      id: "timing", header: t("inspection.terminalResult.timing", "시점"), size: 70,
      accessorFn: (row) => parseTiming(row.inspectData),
      cell: ({ getValue }) => {
        const v = getValue() as CrimpInspectTiming | null;
        return v ? t(TIMING_LABEL_KEY[v]) : "-";
      },
      meta: { align: "center" },
    },
    {
      accessorKey: "passYn", header: t("inspection.terminalResult.result", "판정"), size: 80,
      cell: ({ getValue }) => getValue() === "Y"
        ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400"><CheckCircle className="w-3.5 h-3.5" />{t("inspection.terminalResult.resultPass", "합격")}</span>
        : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><XCircle className="w-3.5 h-3.5" />{t("inspection.terminalResult.resultFail", "불합격")}</span>,
      meta: { align: "center" },
    },
    {
      accessorKey: "errorDetail", header: t("inspection.terminalResult.errorDetail", "판정 내용"), size: 320,
      cell: ({ getValue }) => <span className="text-xs text-text-muted">{(getValue() as string | null) ?? "-"}</span>,
    },
    {
      accessorKey: "inspectorId", header: t("inspection.terminalResult.inspector", "검사자"), size: 90,
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string | null) ?? "-"}</span>,
    },
  ], [t]);

  if (loadFailed) {
    return (
      <Card className="flex-1 flex items-center justify-center">
        <CardContent className="text-center text-text-muted space-y-3">
          <p>{t("inspection.terminalResult.loadFailed", "검사 기준을 불러오지 못했습니다.")}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!context) return null;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
      {/* 입력 카드는 내용 높이만 쓰고 남는 높이는 이력이 채운다 — 화면 안에 스크롤이 생기지 않게 */}
      <Card className="shrink min-h-0 overflow-hidden flex flex-col" padding="none">
        <CardContent className="min-h-0 overflow-auto p-3 space-y-3">
          {/* 대상 + 검사자 + 시점 */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0">
              <div className="text-xs text-text-muted">{order.processName ?? order.processCode}</div>
              <div className="font-mono text-lg font-bold text-text">{order.orderNo}</div>
              <div className="text-sm text-text-muted truncate">{order.itemCode}{order.itemName && order.itemName !== order.itemCode ? ` · ${order.itemName}` : ""}</div>
            </div>
            <div className="w-56">
              <WorkerSelect
                label={t("inspection.terminalResult.inspector", "검사자")}
                placeholder={t("inspection.terminalResult.inspectorPlaceholder", "검사자 선택")}
                value={workerId}
                onChange={setWorkerId}
                fullWidth
                required
              />
            </div>
            <div>
              <div className="text-xs font-medium text-text mb-1">{t("inspection.terminalResult.timing", "시점")}</div>
              <div className="inline-flex rounded-md border border-border overflow-hidden" role="radiogroup">
                {CRIMP_INSPECT_TIMING_VALUES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={timing === v}
                    onClick={() => setTiming(v)}
                    className={`px-4 h-9 text-sm font-medium border-r border-border last:border-r-0 ${timing === v ? "bg-primary text-white" : "bg-surface text-text hover:bg-background"}`}
                  >
                    {t(TIMING_LABEL_KEY[v])}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 단자별 압착 측정 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-text">{t("inspection.terminalResult.sides", "단자별 압착 측정")}</h3>
            {context.sides.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />{t("inspection.terminalResult.noTerminal", "작업지시 품목 BOM에 단자가 없습니다.")}
              </p>
            )}
            {context.sides.map((side) => {
              const targets = side.spec ? crimpMeasureTargets(side.spec) : [];
              return (
                <div key={side.sideKey} className="rounded-md border border-border p-2.5 flex items-start gap-3" data-testid={`crimp-side-${side.sideKey}`}>
                  {/* 단자·전선 정보는 왼쪽, 측정칸은 오른쪽 한 줄 — 단자가 3개여도 화면 안에 들어가게 */}
                  <div className="w-44 shrink-0 min-w-0 text-sm leading-5">
                    <div className="truncate">
                      {side.side && <span className="text-xs text-text-muted mr-2">SIDE {side.side}</span>}
                      <span className="text-text-muted mr-1">{t("inspection.terminalResult.terminal", "단자")}</span>
                      <span className="font-mono font-semibold text-text">{side.terminalItemCode}</span>
                    </div>
                    {side.terminalSpec && <div className="text-xs text-text-muted truncate" title={side.terminalSpec}>{side.terminalSpec}</div>}
                    <div className="truncate">
                      <span className="text-text-muted mr-1">{t("inspection.terminalResult.wire", "전선")}</span>
                      <span className="font-mono text-text">{side.wireItemCode ?? "-"}</span>
                      {side.wireSpec && <span className="text-xs text-text-muted ml-1">({side.wireSpec})</span>}
                    </div>
                    {side.spec?.applicatorCode && (
                      <div className="text-xs text-text-muted truncate">{t("master.terminalCrimpSpec.applicatorCode")} {side.spec.applicatorCode}</div>
                    )}
                  </div>
                  {side.status !== "OK" || !side.spec ? (
                    <p className="flex-1 min-w-0 flex items-center gap-2 self-center text-sm text-red-600 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {sideStatusMessage(side.status)} {t("inspection.terminalResult.specMissingHint", "단자별 압착 규격 또는 BOM을 확인하세요.")}
                    </p>
                  ) : (
                    <div className="flex-1 min-w-0 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                      {targets.map((key) => {
                        const value = measures[side.sideKey]?.[key] ?? "";
                        const inSpec = isCrimpValueInSpec(side.spec!, key, value);
                        const { lsl, usl } = crimpLimits(side.spec!, key);
                        const label = t(MEASURE_LABEL_KEY[key]);
                        return (
                          <div key={key} className="min-w-0">
                            <div className="mb-1 text-[11px] leading-[14px]">
                              <div className="font-medium text-text truncate" title={label}>{label}</div>
                              <div className={`tabular-nums truncate ${inSpec === false ? "text-red-600 dark:text-red-400 font-semibold" : "text-text-muted"}`}>
                                {formatRange(lsl, usl)}
                              </div>
                            </div>
                            <Input
                              aria-label={label}
                              type="number"
                              step="0.001"
                              inputMode="decimal"
                              value={value}
                              onChange={(e) => setMeasures((prev) => ({
                                ...prev,
                                [side.sideKey]: { ...prev[side.sideKey], [key]: e.target.value },
                              }))}
                              className={inSpec === false ? "border-red-500 text-red-600 dark:text-red-400" : inSpec === true ? "border-green-600" : ""}
                              fullWidth
                              data-testid={`crimp-measure-${side.sideKey}-${key}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* 판정 기준(단자별 규격)이 없으면 등록할 수 없으므로 외관 판정·비고·등록 입력을 띄우지 않는다 */}
          {context.ready && (<>
          {/* 외관 판정 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-text">{t("inspection.terminalResult.visualChecks", "외관 판정")}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {context.visualChecks.map((v) => (
                <div key={v.code} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <span className="text-sm text-text">{t(`comCode.CRIMP_VISUAL_CHECK.${v.code}`, v.name)}</span>
                  <div className="inline-flex rounded border border-border overflow-hidden" role="radiogroup">
                    {(["OK", "NG"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={visual[v.code] === r}
                        onClick={() => setVisual((prev) => ({ ...prev, [v.code]: r }))}
                        className={`px-3 h-8 text-xs font-bold ${visual[v.code] === r ? (r === "OK" ? "bg-green-600 text-white" : "bg-red-600 text-white") : "bg-surface text-text-muted hover:bg-background"}`}
                        data-testid={`crimp-visual-${v.code}-${r}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex-1 min-w-[16rem]">
              <Input
                aria-label={t("inspection.terminalResult.remark", "비고")}
                placeholder={`${t("inspection.terminalResult.remark", "비고")} — ${t("inspection.terminalResult.remarkPlaceholder", "불량 상세나 특이사항")}`}
                value={remark}
                maxLength={300}
                onChange={(e) => setRemark(e.target.value)}
                fullWidth
              />
            </div>
            {!complete && (
              <span className="text-xs text-text-muted">{t("inspection.terminalResult.missingInput", "검사자·측정값·외관 판정을 모두 입력해야 등록할 수 있습니다.")}</span>
            )}
            {expectedPass !== null && (
              <span className={`text-sm font-semibold ${expectedPass ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {expectedPass ? t("inspection.terminalResult.expectPass", "합격 예상") : t("inspection.terminalResult.expectFail", "불합격 예상")}
              </span>
            )}
            <Button onClick={() => void handleSave()} disabled={!complete || saving} data-testid="crimp-inspect-save">
              <Save className="w-4 h-4 mr-1" />{t("inspection.terminalResult.save", "판정 등록")}
            </Button>
          </div>
          </>)}
        </CardContent>
      </Card>

      {/* 이 작업지시의 검사 이력 */}
      <Card className="flex-1 min-h-[10rem] overflow-hidden flex flex-col" padding="none">
        <CardContent className="flex-1 min-h-0 flex flex-col p-3 gap-2">
          <div className="flex items-baseline gap-3 min-w-0">
            <h3 className="shrink-0 text-sm font-semibold text-text">{t("inspection.terminalResult.history", "검사 이력")}</h3>
            {lastResult && (
              <span
                className={`min-w-0 truncate text-sm font-semibold ${lastResult.passYn === "Y" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                title={lastResult.errorDetail ?? undefined}
              >
                {lastResult.passYn === "Y" ? t("inspection.terminalResult.resultPass", "합격") : t("inspection.terminalResult.resultFail", "불합격")}
                {" · "}{lastResult.resultNo}
                {lastResult.errorDetail ? ` · ${lastResult.errorDetail}` : ""}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <DataGrid
              data={history}
              columns={historyColumns}
              pageSize={100}
              enableColumnFilter={false}
              enableColumnReordering={false}
              getRowId={(row) => row.resultNo}
              emptyMessage={t("inspection.terminalResult.historyEmpty", "이 작업지시의 절압물검사 이력이 없습니다.")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
