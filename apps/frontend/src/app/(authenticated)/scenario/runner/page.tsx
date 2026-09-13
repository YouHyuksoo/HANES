"use client";

/**
 * @file src/app/(authenticated)/scenario/runner/page.tsx
 * @description 시나리오 런너 — 등록된 자동 실행 절차를 보고 직접 돌린다
 *
 * 초보자 가이드:
 * 1. 시나리오는 서버의 definitions/*.json 이 단일 출처다. 여기서 만들거나 고치지 않는다.
 * 2. 평소 실행 경로는 AI 채팅이다("입하 등록해줘"). 이 화면은 AI 없이 직접 고르는 경로다.
 * 3. 실행하면 인앱 드라이버가 화면 버튼을 대신 누른다. 계획 확인 → 실행 → 쓰기 직전 재확인.
 *
 * 이 화면은 **런처다. 모니터가 아니다.**
 * 실행 첫 스텝이 보통 goto 라서, 누르는 순간 이 페이지는 언마운트된다.
 * 진행 상황·실패·AI 원인 분석은 전역 오버레이(ScenarioRunOverlay)가 화면을 넘나들며 책임진다.
 * 그래서 여기에 진행 표시나 결과 이력을 두지 않는다 — 둬도 살아남지 못한다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, RefreshCw, ScrollText, AlertTriangle } from "lucide-react";
import { Button, Card, CardContent, Input } from "@/components/ui";
import api from "@/services/api";
import { useScenarioRunStore } from "@/scenario-driver/store";
import { describeStep } from "@/scenario-driver/ScenarioDriverHost";
import type { Scenario, ScenarioParamSpec } from "@/scenario-driver/types";

/** 목록 응답 — steps 는 담기지 않는다(백엔드 ScenarioSummary) */
interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  startRoute: string;
  params: Record<string, ScenarioParamSpec>;
  writeStepCount: number;
}

export default function ScenarioRunnerPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** 시나리오별 입력값 — 다른 시나리오를 골랐다가 돌아와도 유지된다 */
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  /** 선택한 시나리오의 본문(steps). 목록에는 없으므로 선택 시 따로 받아온다 */
  const [detail, setDetail] = useState<Scenario | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/ai/scenarios");
      setList(res.data?.data ?? []);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || t("scenarioRunner.loadError", "시나리오 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  // 선택이 바뀌면 본문을 받아 단계를 보여준다. 무엇을 하는 절차인지는
  // 설명 한 줄보다 단계 목록이 정확하다 — 실행 전에 그걸 볼 수 있어야 한다.
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let active = true;
    (async () => {
      try {
        const res = await api.get(`/ai/scenarios/${encodeURIComponent(selectedId)}`);
        if (active) setDetail(res.data?.data ?? null);
      } catch {
        if (active) setDetail(null);
      }
    })();
    return () => { active = false; };
  }, [selectedId]);

  const selected = useMemo(() => list.find((s) => s.id === selectedId) ?? null, [list, selectedId]);
  const current = selectedId ? values[selectedId] ?? {} : {};

  const missing = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected.params)
      .filter(([key, spec]) => spec.required && !(current[key] ?? "").trim())
      .map(([, spec]) => spec.label);
  }, [selected, current]);

  const setValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [selectedId!]: { ...(prev[selectedId!] ?? {}), [key]: value } }));
  }, [selectedId]);

  /**
   * 실행 요청. 여기서 하는 일은 store 에 넘기는 것까지다.
   * 계획 확인·실행·쓰기 재확인·실패 안내는 전부 전역 오버레이가 이어받는다.
   */
  const run = useCallback(async () => {
    if (!selected || missing.length > 0) return;
    setStarting(true);
    try {
      const res = await api.get(`/ai/scenarios/${encodeURIComponent(selected.id)}`);
      const scenario: Scenario | undefined = res.data?.data;
      if (!scenario) throw new Error(t("scenarioRunner.loadOneError", "시나리오를 불러오지 못했습니다."));
      useScenarioRunStore.getState().request(scenario, current);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || t("scenarioRunner.startError", "시나리오를 시작하지 못했습니다."));
    } finally {
      setStarting(false);
    }
  }, [selected, missing, current, t]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-text">
            <ScrollText className="h-5 w-5" />
            {t("scenarioRunner.title", "시나리오 런너")}
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            {t("scenarioRunner.subtitle", "등록된 자동 실행 절차입니다. 실행하면 화면 버튼을 대신 눌러 진행합니다.")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh", "새로고침")}
        </Button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded border border-red-300 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* 목록 */}
        <div className="space-y-2">
          {!loading && list.length === 0 && (
            <div className="rounded border border-border px-3 py-6 text-center text-xs text-text-muted">
              {t("scenarioRunner.empty", "등록된 시나리오가 없습니다.")}
            </div>
          )}
          {list.map((s) => {
            const active = s.id === selectedId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded border px-3 py-2.5 text-left transition-colors ${
                  active ? "border-primary" : "border-border hover:border-text-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text">{s.title}</span>
                  {/* 실데이터를 바꾸는 절차인지는 고르기 전에 보여야 한다.
                      오버레이가 다시 확인하지만, 선택은 여기서 일어난다. */}
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${
                      s.writeStepCount > 0
                        ? "border-red-400 text-red-600 dark:border-red-700 dark:text-red-400"
                        : "border-border text-text-muted"
                    }`}
                  >
                    {s.writeStepCount > 0
                      ? t("scenarioRunner.writeSteps", "저장 {{count}}단계", { count: s.writeStepCount })
                      : t("scenarioRunner.readonly", "조회 전용")}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-text-muted">{s.description}</p>
                <div className="mt-1 font-mono text-[11px] text-text-muted">{s.startRoute}</div>
              </button>
            );
          })}
        </div>

        {/* 선택한 절차 — 값 입력과 단계 */}
        <Card>
          <CardContent className="p-4">
            {!selected ? (
              <div className="py-10 text-center text-xs text-text-muted">
                {t("scenarioRunner.selectPrompt", "왼쪽에서 절차를 고르세요.")}
              </div>
            ) : (
              <>
                <div className="text-sm font-bold text-text">{selected.title}</div>
                <p className="mt-1 text-xs text-text-muted">{selected.description}</p>

                {Object.keys(selected.params).length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold text-text">{t("scenarioRunner.params", "실행 값")}</div>
                    {Object.entries(selected.params).map(([key, spec]) => (
                      <div key={key} className="flex items-center gap-2">
                        <label className="w-24 shrink-0 text-xs text-text-muted" htmlFor={`scn-${key}`}>
                          {spec.label}
                          {spec.required && <span className="text-red-500"> *</span>}
                        </label>
                        <Input
                          id={`scn-${key}`}
                          type={spec.type === "number" ? "number" : "text"}
                          value={current[key] ?? ""}
                          onChange={(e) => setValue(key, e.target.value)}
                          fullWidth
                        />
                      </div>
                    ))}
                  </div>
                )}

                {detail && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-text">
                      {t("scenarioRunner.steps", "단계")} ({detail.steps.length})
                    </div>
                    <ol className="mt-1 space-y-1 text-xs text-text-muted">
                      {detail.steps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="w-4 shrink-0 text-right">{i + 1}</span>
                          {/* 실행 오버레이와 같은 함수로 설명을 만든다 —
                              입력한 값이 그대로 치환돼 "{{itemCode}}" 가 아니라 실제 품목으로 보인다 */}
                          <span className={step.write ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                            {describeStep(step, current)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end gap-2">
                  {missing.length > 0 && (
                    <span className="text-xs text-text-muted">
                      {t("scenarioRunner.missing", "필요한 값: {{names}}", { names: missing.join(", ") })}
                    </span>
                  )}
                  <Button onClick={() => void run()} disabled={starting || missing.length > 0}>
                    <Play className="h-4 w-4" />
                    {t("scenarioRunner.run", "실행")}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
