/**
 * @file system/health/types.ts
 * @description /system/health/snapshot 응답 형태 — 백엔드 SystemHealthSnapshot 과 같은 모양
 */
export type AssessLevel = "ok" | "warn" | "crit";
export interface Assessment { level: AssessLevel; code: string; message: string }

export interface RouteStat {
  method: string; route: string; count: number; perMinute: number; errors: number;
  avgMs: number; p95Ms: number; maxMs: number; avgQueries: number; maxQueries: number;
}
export interface WindowSummary {
  windowSec: number; requests: number; rps: number; errors: number; errorRate: number;
  p50Ms: number; p95Ms: number; maxMs: number; activeUsers: number; activeIps: number; routes: RouteStat[];
}
export interface SlowQuerySample { at: number; ms: number; sql: string }
export interface RequestSample {
  at: number; method: string; route: string; status: number; ms: number; queries: number;
  userId?: string; ip?: string; error?: string;
}
export interface PoolStats {
  currentQueueLength?: number; maximumQueueLength?: number; requestsEnqueued?: number; requestTimeouts?: number;
  rejectedRequests?: number; failedRequests?: number; connectionRequests?: number;
  averageTimeInQueue?: number; maximumTimeInQueue?: number; upTime?: number;
}
export interface SystemHealthSnapshot {
  at: string;
  process: {
    pid: number; nodeVersion: string; env: string; uptimeSec: number;
    pm2: { instance: string | null; pmId: string | null };
    memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number; externalMb: number; limitMb: number };
    cpu: { processPct: number; cores: number; loadAvg1: number };
    eventLoop: { meanMs: number; p50Ms: number; p99Ms: number; maxMs: number } | null;
  };
  pool: {
    config: { poolMax: number; poolMin: number; queueTimeoutMs: number; connectTimeoutSec: number; expireTimeMin: number; poolPingIntervalSec: number; callTimeoutMs: number };
    live: { connectionsOpen: number; connectionsInUse: number; utilization: number } | null;
    stats: PoolStats | null;
    error: string | null;
  };
  db: {
    pingMs: number | null;
    sessions: { total: number; mine: number; mineActive: number; blocked: number } | null;
    limits: Array<{ resource: string; current: number; max: number; limit: number | null }> | null;
    longRunning: Array<{ sid: number; status: string; seconds: number; event: string | null; sqlId: string | null; sqlText: string | null; blockingSession: number | null }> | null;
    error: string | null;
  };
  http: { last1m: WindowSummary; last5m: WindowSummary; last15m: WindowSummary };
  slowQueries: SlowQuerySample[];
  recentErrors: RequestSample[];
  assessments: Assessment[];
  thresholds: {
    poolUtilWarn: number; eventLoopP99WarnMs: number; eventLoopP99CritMs: number; errorRateWarnPct: number;
    dbPingWarnMs: number; sessionUtilWarn: number; nPlusOneQueries: number; pollingPerMinute: number;
    heapWarnRatio: number; maxMemoryMb: number;
  };
}

export const REFETCH_OPTIONS = [5, 10, 30, 60] as const;

export function formatClock(value: string | number): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleTimeString("ko-KR", { hour12: false });
}

export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
}
