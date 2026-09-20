"use client";

/**
 * @file system/health/page.tsx
 * @description 시스템 상태 모니터 — 접속 세션·요청 부하·DB 커넥션 풀·Oracle 세션·프로세스 자원을 한 화면에서 보고
 *              "100 세션 감당" 관점의 임계값 판정(assessments)을 맨 위에 띄운다.
 *
 * 초보자 가이드:
 * 1. 데이터는 /system/health/snapshot 하나다. 백엔드 프로세스 메모리(요청 지표 링 버퍼)와 Oracle V$ 뷰, oracledb 풀을 그 자리에서 읽는다.
 * 2. 카드 박스 그리드 대신 큰 숫자 띠 + 구분선 + 표로 읽는 화면이다(모니터링 화면 규칙).
 * 3. 임계값은 서버 THRESHOLDS 가 단일 출처이고, 화면은 응답의 thresholds 로 강조 색만 정한다.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, AlertTriangle, CheckCircle2, Pause, Play, RefreshCw, XOctagon } from "lucide-react";
import { useApiQuery } from "@/hooks/useApi";
import { Button, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import {
  REFETCH_OPTIONS, formatClock, formatUptime,
  type Assessment, type RequestSample, type RouteStat, type SlowQuerySample, type SystemHealthSnapshot,
} from "./types";

const LEVEL_STYLE: Record<Assessment["level"], { border: string; text: string; Icon: typeof AlertTriangle }> = {
  crit: { border: "border-l-red-600 dark:border-l-red-400", text: "text-red-700 dark:text-red-300", Icon: XOctagon },
  warn: { border: "border-l-amber-600 dark:border-l-amber-400", text: "text-amber-700 dark:text-amber-300", Icon: AlertTriangle },
  ok: { border: "border-l-border", text: "text-text-muted", Icon: CheckCircle2 },
};

/** 큰 숫자 한 칸 — 라벨 작게, 값 크게. 경고면 값 색만 바꾼다(파스텔 배경 없음) */
function Kpi({ label, value, unit, tone = "normal", hint }: { label: string; value: string | number; unit?: string; tone?: "normal" | "warn" | "crit"; hint?: string }) {
  const color = tone === "crit" ? "text-red-600 dark:text-red-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-text";
  return (
    <div className="min-w-[9rem] flex-1 px-4 py-3" data-testid="health-kpi">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div className={`mt-0.5 text-3xl font-extrabold tabular-nums leading-none ${color}`}>
        {value}{unit && <span className="ml-1 text-base font-semibold text-text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] text-text-muted">{hint}</div>}
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mt-6 flex items-end justify-between border-b-2 border-border pb-1">
      <h2 className="text-sm font-bold uppercase tracking-wide text-text">{children}</h2>
      {right && <div className="text-xs text-text-muted">{right}</div>}
    </div>
  );
}

export default function SystemHealthPage() {
  const { t } = useTranslation();
  const [refetchSec, setRefetchSec] = useState<number>(10);
  const [paused, setPaused] = useState(false);

  const { data: res, isFetching, refetch, dataUpdatedAt } = useApiQuery<SystemHealthSnapshot>(
    ["system", "health", "snapshot"],
    "/system/health/snapshot",
    { refetchInterval: paused ? false : refetchSec * 1000, refetchOnWindowFocus: false },
  );
  const s = res?.data;
  const T = s?.thresholds;

  const routeColumns = useMemo<ColumnDef<RouteStat, unknown>[]>(() => [
    { accessorKey: "method", header: t("system.health.load.method"), size: 70 },
    { accessorKey: "route", header: t("system.health.load.route"), size: 300, cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
    { accessorKey: "count", header: t("system.health.load.count"), size: 70 },
    { accessorKey: "perMinute", header: t("system.health.load.perMin"), size: 80,
      cell: ({ getValue }) => { const v = Number(getValue()); return <span className={T && v >= T.pollingPerMinute ? "font-bold text-amber-600 dark:text-amber-400" : ""}>{v}</span>; } },
    { accessorKey: "avgMs", header: t("system.health.load.avg"), size: 80 },
    { accessorKey: "p95Ms", header: t("system.health.load.p95"), size: 80 },
    { accessorKey: "maxMs", header: t("system.health.load.max"), size: 80 },
    { accessorKey: "avgQueries", header: t("system.health.load.queries"), size: 90,
      cell: ({ getValue }) => { const v = Number(getValue()); return <span className={T && v >= T.nPlusOneQueries ? "font-bold text-red-600 dark:text-red-400" : ""}>{v}</span>; } },
    { accessorKey: "maxQueries", header: t("system.health.load.maxQueries"), size: 90 },
    { accessorKey: "errors", header: t("system.health.load.errors"), size: 70,
      cell: ({ getValue }) => { const v = Number(getValue()); return <span className={v > 0 ? "font-bold text-red-600 dark:text-red-400" : ""}>{v}</span>; } },
  ], [t, T]);

  const slowColumns = useMemo<ColumnDef<SlowQuerySample, unknown>[]>(() => [
    { accessorKey: "at", header: t("system.health.slow.at"), size: 90, cell: ({ getValue }) => formatClock(Number(getValue())) },
    { accessorKey: "ms", header: t("system.health.slow.ms"), size: 80, cell: ({ getValue }) => <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">{Number(getValue()).toLocaleString()}</span> },
    { accessorKey: "sql", header: t("system.health.slow.sql"), size: 700, cell: ({ getValue }) => <span className="font-mono text-xs" title={String(getValue())}>{String(getValue())}</span> },
  ], [t]);

  const errorColumns = useMemo<ColumnDef<RequestSample, unknown>[]>(() => [
    { accessorKey: "at", header: t("system.health.err.at"), size: 90, cell: ({ getValue }) => formatClock(Number(getValue())) },
    { accessorKey: "method", header: t("system.health.load.method"), size: 70 },
    { accessorKey: "route", header: t("system.health.load.route"), size: 260, cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
    { accessorKey: "status", header: t("system.health.err.status"), size: 70 },
    { accessorKey: "ms", header: t("system.health.slow.ms"), size: 80 },
    { accessorKey: "error", header: t("system.health.err.message"), size: 500, cell: ({ getValue }) => <span className="text-xs" title={String(getValue() ?? "")}>{String(getValue() ?? "")}</span> },
  ], [t]);

  const longRunning = s?.db.longRunning ?? [];
  const pool = s?.pool;
  const util = pool?.live ? Math.round(pool.live.utilization * 100) : null;
  const loopP99 = s?.process.eventLoop?.p99Ms ?? null;

  return (
    <div className="flex h-full flex-col overflow-auto px-4 pb-8">
      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-text">
            <Activity className="h-5 w-5 text-primary" />
            {t("system.health.title")}
          </h1>
          <p className="text-xs text-text-muted">{t("system.health.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {s && (
            <span className="font-mono text-[11px] text-text-muted" data-testid="health-process-badge">
              pid {s.process.pid} · {s.process.env} · {s.process.pm2.instance !== null ? `pm2#${s.process.pm2.instance}` : t("system.health.process.fork")} · {t("system.health.updatedAt")} {formatClock(dataUpdatedAt || s.at)}
            </span>
          )}
          <Select
            aria-label={t("system.health.interval")}
            value={String(refetchSec)}
            onChange={(v) => setRefetchSec(Number(v))}
            options={REFETCH_OPTIONS.map((sec) => ({ value: String(sec), label: `${sec}s` }))}
          />
          <Button size="sm" variant="secondary" onClick={() => setPaused((p) => !p)} leftIcon={paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}>
            {paused ? t("system.health.resume") : t("system.health.pause")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void refetch()} leftIcon={<RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}>
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* ── 판정 ── */}
      <SectionTitle>{t("system.health.sections.assess")}</SectionTitle>
      <ul className="mt-2 space-y-1" data-testid="health-assessments">
        {(s?.assessments ?? []).map((a) => {
          const st = LEVEL_STYLE[a.level];
          return (
            <li key={a.code} className={`flex items-start gap-2 border-l-4 py-1.5 pl-3 ${st.border}`}>
              <st.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${st.text}`} />
              <span className={`text-sm ${a.level === "ok" ? "text-text-muted" : "font-semibold text-text"}`}>
                <span className="mr-2 font-mono text-[11px] text-text-muted">{a.code}</span>{a.message}
              </span>
            </li>
          );
        })}
        {!s && <li className="text-sm text-text-muted">{t("common.loading")}</li>}
      </ul>

      {/* ── 핵심 지표 ── */}
      <SectionTitle right={t("system.health.kpi.windowHint")}>{t("system.health.sections.kpi")}</SectionTitle>
      <div className="mt-1 flex flex-wrap divide-x divide-border" data-testid="health-kpi-strip">
        <Kpi label={t("system.health.kpi.activeUsers")} value={s?.http.last5m.activeUsers ?? "-"} hint={`${t("system.health.kpi.ips")} ${s?.http.last5m.activeIps ?? "-"} · 15m ${s?.http.last15m.activeUsers ?? "-"}`} />
        <Kpi label={t("system.health.kpi.rps")} value={s?.http.last1m.rps ?? "-"} unit="req/s" hint={`5m ${s?.http.last5m.rps ?? "-"} · 15m ${s?.http.last15m.rps ?? "-"}`} />
        <Kpi label={t("system.health.kpi.errorRate")} value={s?.http.last5m.errorRate ?? "-"} unit="%" tone={s && T && s.http.last5m.errorRate >= T.errorRateWarnPct ? "warn" : "normal"} hint={`${s?.http.last5m.errors ?? "-"} / ${s?.http.last5m.requests ?? "-"}`} />
        <Kpi label={t("system.health.kpi.p95")} value={s?.http.last5m.p95Ms ?? "-"} unit="ms" hint={`p50 ${s?.http.last5m.p50Ms ?? "-"} · max ${s?.http.last5m.maxMs ?? "-"}`} />
        <Kpi label={t("system.health.kpi.dbPing")} value={s?.db.pingMs ?? "-"} unit="ms" tone={s ? (s.db.pingMs === null ? "crit" : T && s.db.pingMs > T.dbPingWarnMs ? "warn" : "normal") : "normal"} hint={T ? `${t("system.health.kpi.warnAt")} ${T.dbPingWarnMs}ms` : undefined} />
        <Kpi label={t("system.health.kpi.loop")} value={loopP99 ?? "-"} unit="ms" tone={loopP99 !== null && T ? (loopP99 >= T.eventLoopP99CritMs ? "crit" : loopP99 >= T.eventLoopP99WarnMs ? "warn" : "normal") : "normal"} hint={`mean ${s?.process.eventLoop?.meanMs ?? "-"} · max ${s?.process.eventLoop?.maxMs ?? "-"}`} />
        <Kpi label={t("system.health.kpi.pool")} value={pool?.live ? `${pool.live.connectionsInUse}/${pool.config.poolMax}` : "-"} tone={util !== null && T && util >= T.poolUtilWarn * 100 ? "warn" : "normal"} hint={util !== null ? `${util}% · open ${pool?.live?.connectionsOpen}` : pool?.error ?? undefined} />
      </div>

      {/* ── DB 커넥션 풀 ── */}
      <SectionTitle right={pool ? `poolMax ${pool.config.poolMax} · queueTimeout ${pool.config.queueTimeoutMs / 1000}s · connectTimeout ${pool.config.connectTimeoutSec}s · keepalive ${pool.config.expireTimeMin}m · ping ${pool.config.poolPingIntervalSec}s · callTimeout ${pool.config.callTimeoutMs / 1000}s` : undefined}>
        {t("system.health.sections.pool")}
      </SectionTitle>
      {pool?.live && (
        <div className="mt-2" data-testid="health-pool-bar">
          <div className="flex h-3 w-full overflow-hidden rounded bg-surface">
            <div className={`${util !== null && T && util >= T.poolUtilWarn * 100 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.min(100, (pool.live.connectionsInUse / pool.config.poolMax) * 100)}%` }} title={t("system.health.pool.inUse")} />
            <div className="bg-primary/30" style={{ width: `${Math.min(100, Math.max(0, (pool.live.connectionsOpen - pool.live.connectionsInUse) / pool.config.poolMax) * 100)}%` }} title={t("system.health.pool.open")} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div><span className="text-text-muted">{t("system.health.pool.inUse")}</span> <b className="tabular-nums">{pool.live.connectionsInUse}</b></div>
            <div><span className="text-text-muted">{t("system.health.pool.open")}</span> <b className="tabular-nums">{pool.live.connectionsOpen}</b></div>
            <div><span className="text-text-muted">{t("system.health.pool.queueLen")}</span> <b className={`tabular-nums ${(pool.stats?.currentQueueLength ?? 0) > 0 ? "text-amber-600" : ""}`}>{pool.stats?.currentQueueLength ?? "-"}</b> <span className="text-xs text-text-muted">(max {pool.stats?.maximumQueueLength ?? "-"})</span></div>
            <div><span className="text-text-muted">{t("system.health.pool.timeouts")}</span> <b className={`tabular-nums ${(pool.stats?.requestTimeouts ?? 0) > 0 ? "text-red-600" : ""}`}>{pool.stats?.requestTimeouts ?? "-"}</b> <span className="text-xs text-text-muted">NJS-040</span></div>
            <div><span className="text-text-muted">{t("system.health.pool.enqueued")}</span> <b className="tabular-nums">{pool.stats?.requestsEnqueued ?? "-"}</b> <span className="text-xs text-text-muted">/ {pool.stats?.connectionRequests ?? "-"}</span></div>
            <div><span className="text-text-muted">{t("system.health.pool.queueMs")}</span> <b className="tabular-nums">{pool.stats?.averageTimeInQueue ?? "-"}</b> <span className="text-xs text-text-muted">avg · max {pool.stats?.maximumTimeInQueue ?? "-"}</span></div>
          </div>
        </div>
      )}
      {pool?.error && <p className="mt-2 text-sm text-amber-600">{pool.error}</p>}

      {/* ── Oracle 세션 ── */}
      <SectionTitle right={s?.db.error ?? undefined}>{t("system.health.sections.oracle")}</SectionTitle>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4" data-testid="health-oracle">
        <div><span className="text-text-muted">{t("system.health.oracle.total")}</span> <b className="tabular-nums">{s?.db.sessions?.total ?? "-"}</b></div>
        <div><span className="text-text-muted">{t("system.health.oracle.mine")}</span> <b className="tabular-nums">{s?.db.sessions?.mine ?? "-"}</b> <span className="text-xs text-text-muted">{t("system.health.oracle.active")} {s?.db.sessions?.mineActive ?? "-"}</span></div>
        <div><span className="text-text-muted">{t("system.health.oracle.blocked")}</span> <b className={`tabular-nums ${(s?.db.sessions?.blocked ?? 0) > 0 ? "text-amber-600" : ""}`}>{s?.db.sessions?.blocked ?? "-"}</b></div>
        <div>
          {(s?.db.limits ?? []).map((l) => (
            <span key={l.resource} className="mr-3"><span className="text-text-muted">{l.resource}</span> <b className="tabular-nums">{l.current}</b><span className="text-xs text-text-muted">/{l.limit ?? "∞"} (peak {l.max})</span></span>
          ))}
        </div>
      </div>
      {longRunning.length > 0 && (
        <table className="mt-2 w-full text-xs" data-testid="health-long-running">
          <thead><tr className="border-b border-border text-left text-text-muted">
            <th className="py-1 pr-2">SID</th><th className="pr-2">{t("system.health.oracle.seconds")}</th><th className="pr-2">{t("system.health.oracle.event")}</th><th className="pr-2">SQL_ID</th><th>{t("system.health.oracle.sql")}</th>
          </tr></thead>
          <tbody>
            {longRunning.map((r) => (
              <tr key={r.sid} className={`border-b border-border/50 ${r.blockingSession ? "text-amber-700 dark:text-amber-300" : ""}`}>
                <td className="py-1 pr-2 font-mono">{r.sid}{r.blockingSession ? ` ← ${r.blockingSession}` : ""}</td>
                <td className="pr-2 tabular-nums">{r.seconds}</td>
                <td className="pr-2">{r.event ?? ""}</td>
                <td className="pr-2 font-mono">{r.sqlId ?? ""}</td>
                <td className="font-mono" title={r.sqlText ?? ""}>{r.sqlText ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── 요청 부하 ── */}
      <SectionTitle right={T ? `${t("system.health.load.legend")}: ${t("system.health.load.perMin")} ≥ ${T.pollingPerMinute} · ${t("system.health.load.queries")} ≥ ${T.nPlusOneQueries}` : undefined}>
        {t("system.health.sections.load")}
      </SectionTitle>
      <div className="mt-2" data-testid="health-load-grid">
        <DataGrid data={s?.http.last15m.routes ?? []} columns={routeColumns} isLoading={!s} pageSize={30} maxHeight="24rem" />
      </div>

      {/* ── 느린 쿼리 ── */}
      <SectionTitle right={`> 3,000 ms`}>{t("system.health.sections.slow")}</SectionTitle>
      <div className="mt-2">
        <DataGrid data={s?.slowQueries ?? []} columns={slowColumns} isLoading={!s} pageSize={20} maxHeight="16rem" emptyMessage={t("system.health.slow.none")} />
      </div>

      {/* ── 최근 에러 ── */}
      <SectionTitle>{t("system.health.sections.errors")}</SectionTitle>
      <div className="mt-2">
        <DataGrid data={s?.recentErrors ?? []} columns={errorColumns} isLoading={!s} pageSize={20} maxHeight="16rem" emptyMessage={t("system.health.err.none")} />
      </div>

      {/* ── 프로세스 ── */}
      <SectionTitle>{t("system.health.sections.process")}</SectionTitle>
      {s && (
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-6" data-testid="health-process">
          <div><span className="text-text-muted">{t("system.health.process.memory")}</span> <b className={`tabular-nums ${s.process.memory.rssMb / s.process.memory.limitMb >= s.thresholds.heapWarnRatio ? "text-amber-600" : ""}`}>{s.process.memory.rssMb}</b> <span className="text-xs text-text-muted">/ {s.process.memory.limitMb} MB</span></div>
          <div><span className="text-text-muted">{t("system.health.process.heap")}</span> <b className="tabular-nums">{s.process.memory.heapUsedMb}</b> <span className="text-xs text-text-muted">/ {s.process.memory.heapTotalMb} MB</span></div>
          <div><span className="text-text-muted">{t("system.health.process.cpu")}</span> <b className="tabular-nums">{s.process.cpu.processPct}%</b> <span className="text-xs text-text-muted">{s.process.cpu.cores} cores</span></div>
          <div><span className="text-text-muted">{t("system.health.process.uptime")}</span> <b>{formatUptime(s.process.uptimeSec)}</b></div>
          <div><span className="text-text-muted">Node</span> <b>{s.process.nodeVersion}</b></div>
          <div><span className="text-text-muted">{t("system.health.process.loop")}</span> <b className="tabular-nums">{s.process.eventLoop ? `${s.process.eventLoop.meanMs} / ${s.process.eventLoop.p50Ms} / ${s.process.eventLoop.p99Ms} / ${s.process.eventLoop.maxMs}` : "-"}</b> <span className="text-xs text-text-muted">mean/p50/p99/max ms</span></div>
        </div>
      )}

      {/* ── 읽는 법 ── */}
      <SectionTitle>{t("system.health.sections.help")}</SectionTitle>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-muted">
        {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((k) => <li key={k}>{t(`system.health.help.${k}`)}</li>)}
      </ul>
    </div>
  );
}
