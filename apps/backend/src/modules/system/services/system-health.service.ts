/**
 * @file modules/system/services/system-health.service.ts
 * @description 시스템 상태 스냅샷 — 접속 세션·요청 부하·DB 풀·Oracle 세션·프로세스 자원을 한 번에 모아 판정한다.
 *
 * 초보자 가이드:
 * 1. 화면(/system/health)이 5~30초마다 getSnapshot() 을 부른다. 외부 저장소 없이 프로세스 메모리(RequestMetricsStore)와
 *    Oracle V$ 뷰, oracledb 풀 객체를 그 자리에서 읽는다.
 * 2. assessments 는 "100 세션 감당" 관점의 임계값 판정이다(풀 사용률·큐 대기·이벤트루프 지연·에러율·느린쿼리·N+1·폴링·DB 왕복).
 *    임계값은 THRESHOLDS 한 곳에 있다.
 * 3. V$ 뷰 권한이 없거나 DB 가 끊겼으면 그 항목은 null + 사유 문자열로 내려 화면이 깨지지 않게 한다.
 */
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as os from 'os';
import { oraclePoolExtra } from '../../../database/oracle-env';
import {
  requestMetricsStore,
  type EventLoopStat,
  type RequestSample,
  type SlowQuerySample,
  type WindowSummary,
} from '../../../common/metrics/request-metrics.store';

/** 판정 임계값 — 화면 도움말과 같은 숫자를 써야 한다 */
export const THRESHOLDS = {
  poolUtilWarn: 0.7,
  eventLoopP99WarnMs: 100,
  eventLoopP99CritMs: 500,
  errorRateWarnPct: 2,
  dbPingWarnMs: 300,
  sessionUtilWarn: 0.7,
  nPlusOneQueries: 8,
  pollingPerMinute: 30,
  heapWarnRatio: 0.7,
  maxMemoryMb: 1024, // ecosystem.config.js max_memory_restart 1G
} as const;

export type AssessLevel = 'ok' | 'warn' | 'crit';
export interface Assessment { level: AssessLevel; code: string; message: string }

interface OraclePoolLike {
  poolMax?: number;
  poolMin?: number;
  connectionsOpen?: number;
  connectionsInUse?: number;
  queueTimeout?: number;
  poolPingInterval?: number;
  poolTimeout?: number;
  getStatistics?: () => PoolStatisticsLike | null | Promise<PoolStatisticsLike | null>;
}
interface PoolStatisticsLike {
  currentQueueLength?: number;
  maximumQueueLength?: number;
  requestsEnqueued?: number;
  requestTimeouts?: number;
  rejectedRequests?: number;
  failedRequests?: number;
  connectionRequests?: number;
  averageTimeInQueue?: number;
  maximumTimeInQueue?: number;
  upTime?: number;
}

export interface SystemHealthSnapshot {
  at: string;
  process: {
    pid: number;
    nodeVersion: string;
    env: string;
    uptimeSec: number;
    pm2: { instance: string | null; pmId: string | null };
    memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number; externalMb: number; limitMb: number };
    cpu: { processPct: number; cores: number; loadAvg1: number };
    eventLoop: EventLoopStat | null;
  };
  pool: {
    config: { poolMax: number; poolMin: number; queueTimeoutMs: number; connectTimeoutSec: number; expireTimeMin: number; poolPingIntervalSec: number; callTimeoutMs: number };
    live: { connectionsOpen: number; connectionsInUse: number; utilization: number } | null;
    stats: PoolStatisticsLike | null;
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
  thresholds: typeof THRESHOLDS;
}

/** TypeORM OracleDriver 는 oracledb 풀을 master 에 든다 — 캐스팅 대신 구조로 좁힌다 */
function hasMasterPool(driver: unknown): driver is { master?: OraclePoolLike } {
  return typeof driver === 'object' && driver !== null && 'master' in driver;
}

const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

@Injectable()
export class SystemHealthService {
  private lastCpu = process.cpuUsage();
  private lastCpuAt = Date.now();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    requestMetricsStore.enableEventLoopMonitor();
  }

  async getSnapshot(): Promise<SystemHealthSnapshot> {
    const [pool, db] = await Promise.all([this.readPool(), this.readDb()]);
    const http = {
      last1m: requestMetricsStore.summarize(60_000),
      last5m: requestMetricsStore.summarize(5 * 60_000),
      last15m: requestMetricsStore.summarize(15 * 60_000),
    };
    const slowQueries = requestMetricsStore.recentSlowQueries();
    const recentErrors = requestMetricsStore.recentErrors();
    const proc = this.readProcess();
    const snapshot: SystemHealthSnapshot = {
      at: new Date().toISOString(),
      process: proc, pool, db, http, slowQueries, recentErrors,
      assessments: [],
      thresholds: THRESHOLDS,
    };
    snapshot.assessments = this.assess(snapshot);
    return snapshot;
  }

  private readProcess(): SystemHealthSnapshot['process'] {
    const mem = process.memoryUsage();
    const now = Date.now();
    const cpu = process.cpuUsage(this.lastCpu);
    const elapsedUs = Math.max(1, (now - this.lastCpuAt) * 1000);
    const processPct = Math.round(((cpu.user + cpu.system) / elapsedUs) * 1000) / 10;
    this.lastCpu = process.cpuUsage();
    this.lastCpuAt = now;
    return {
      pid: process.pid,
      nodeVersion: process.version,
      env: process.env.NODE_ENV ?? 'development',
      uptimeSec: Math.round(process.uptime()),
      pm2: { instance: process.env.NODE_APP_INSTANCE ?? null, pmId: process.env.pm_id ?? null },
      memory: { rssMb: mb(mem.rss), heapUsedMb: mb(mem.heapUsed), heapTotalMb: mb(mem.heapTotal), externalMb: mb(mem.external), limitMb: THRESHOLDS.maxMemoryMb },
      cpu: { processPct, cores: os.cpus().length, loadAvg1: Math.round(os.loadavg()[0] * 100) / 100 },
      eventLoop: requestMetricsStore.eventLoop(),
    };
  }

  private async readPool(): Promise<SystemHealthSnapshot['pool']> {
    const extra = oraclePoolExtra();
    const conn: { callTimeout?: number } = {};
    extra.sessionCallback(conn, '', () => undefined);
    const config = {
      poolMax: extra.poolMax, poolMin: extra.poolMin, queueTimeoutMs: extra.queueTimeout,
      connectTimeoutSec: extra.connectTimeout, expireTimeMin: extra.expireTime,
      poolPingIntervalSec: extra.poolPingInterval, callTimeoutMs: conn.callTimeout ?? 0,
    };
    try {
      const driver: unknown = this.dataSource.driver;
      const pool = hasMasterPool(driver) ? driver.master : undefined;
      if (!pool) return { config, live: null, stats: null, error: 'oracledb 풀 객체를 찾지 못했습니다(드라이버 미초기화).' };
      const open = num(pool.connectionsOpen);
      const inUse = num(pool.connectionsInUse);
      const max = num(pool.poolMax) || config.poolMax;
      let stats: PoolStatisticsLike | null = null;
      if (typeof pool.getStatistics === 'function') {
        const raw = await pool.getStatistics();
        if (raw) {
          stats = {
            currentQueueLength: num(raw.currentQueueLength), maximumQueueLength: num(raw.maximumQueueLength),
            requestsEnqueued: num(raw.requestsEnqueued), requestTimeouts: num(raw.requestTimeouts),
            rejectedRequests: num(raw.rejectedRequests), failedRequests: num(raw.failedRequests),
            connectionRequests: num(raw.connectionRequests), averageTimeInQueue: num(raw.averageTimeInQueue),
            maximumTimeInQueue: num(raw.maximumTimeInQueue), upTime: num(raw.upTime),
          };
        }
      }
      return { config, live: { connectionsOpen: open, connectionsInUse: inUse, utilization: max ? Math.round((inUse / max) * 100) / 100 : 0 }, stats, error: null };
    } catch (e: unknown) {
      return { config, live: null, stats: null, error: errMsg(e) };
    }
  }

  private async readDb(): Promise<SystemHealthSnapshot['db']> {
    const result: SystemHealthSnapshot['db'] = { pingMs: null, sessions: null, limits: null, longRunning: null, error: null };
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1 FROM DUAL');
      result.pingMs = Date.now() - started;
    } catch (e: unknown) {
      result.error = `DB 왕복 실패: ${errMsg(e)}`;
      return result;
    }
    const errors: string[] = [];
    try {
      const rows = await this.dataSource.query(
        `SELECT COUNT(*) AS "total",
                SUM(CASE WHEN USERNAME = USER THEN 1 ELSE 0 END) AS "mine",
                SUM(CASE WHEN USERNAME = USER AND STATUS = 'ACTIVE' THEN 1 ELSE 0 END) AS "mineActive",
                SUM(CASE WHEN BLOCKING_SESSION IS NOT NULL THEN 1 ELSE 0 END) AS "blocked"
           FROM V$SESSION`,
      );
      const r = rows?.[0] ?? {};
      result.sessions = { total: num(r.total), mine: num(r.mine), mineActive: num(r.mineActive), blocked: num(r.blocked) };
    } catch (e: unknown) { errors.push(`V$SESSION: ${errMsg(e)}`); }
    try {
      const rows = await this.dataSource.query(
        `SELECT RESOURCE_NAME AS "resource", CURRENT_UTILIZATION AS "current", MAX_UTILIZATION AS "max", LIMIT_VALUE AS "limit"
           FROM V$RESOURCE_LIMIT WHERE RESOURCE_NAME IN ('processes', 'sessions')`,
      );
      result.limits = (rows ?? []).map((r: Record<string, unknown>) => ({
        resource: String(r.resource), current: num(r.current), max: num(r.max),
        limit: /^\d+$/.test(String(r.limit ?? '').trim()) ? Number(r.limit) : null,
      }));
    } catch (e: unknown) { errors.push(`V$RESOURCE_LIMIT: ${errMsg(e)}`); }
    try {
      const rows = await this.dataSource.query(
        `SELECT s.SID AS "sid", s.STATUS AS "status", s.LAST_CALL_ET AS "seconds", s.EVENT AS "event",
                s.SQL_ID AS "sqlId", s.BLOCKING_SESSION AS "blockingSession",
                (SELECT SUBSTR(q.SQL_TEXT, 1, 160) FROM V$SQLAREA q WHERE q.SQL_ID = s.SQL_ID AND ROWNUM = 1) AS "sqlText"
           FROM V$SESSION s
          WHERE s.USERNAME = USER AND s.STATUS = 'ACTIVE' AND s.SID <> SYS_CONTEXT('USERENV', 'SID')
            AND (s.LAST_CALL_ET >= 3 OR s.BLOCKING_SESSION IS NOT NULL)
          ORDER BY s.LAST_CALL_ET DESC FETCH FIRST 10 ROWS ONLY`,
      );
      result.longRunning = (rows ?? []).map((r: Record<string, unknown>) => ({
        sid: num(r.sid), status: String(r.status ?? ''), seconds: num(r.seconds),
        event: r.event ? String(r.event) : null, sqlId: r.sqlId ? String(r.sqlId) : null,
        sqlText: r.sqlText ? String(r.sqlText) : null, blockingSession: r.blockingSession ? num(r.blockingSession) : null,
      }));
    } catch (e: unknown) { errors.push(`V$SQLAREA: ${errMsg(e)}`); }
    if (errors.length) result.error = errors.join(' / ');
    return result;
  }

  /** 임계값 판정 — 화면 상단 경고 띠. 순서: 치명 → 경고 → 정보 */
  assess(s: SystemHealthSnapshot): Assessment[] {
    const out: Assessment[] = [];
    const T = THRESHOLDS;
    if (s.db.pingMs === null) out.push({ level: 'crit', code: 'DB_DOWN', message: `DB 왕복 실패 — ${s.db.error ?? '원인 미상'}. 모든 요청이 큐 대기(${s.pool.config.queueTimeoutMs / 1000}초) 후 500 이 됩니다.` });
    else if (s.db.pingMs > T.dbPingWarnMs) out.push({ level: 'warn', code: 'DB_SLOW', message: `DB 왕복 ${s.db.pingMs}ms (경고 ${T.dbPingWarnMs}ms) — 앱↔DB 네트워크(VPN) 지연을 의심하세요.` });

    if (s.pool.live) {
      if (s.pool.live.utilization >= T.poolUtilWarn) out.push({ level: 'warn', code: 'POOL_HOT', message: `DB 풀 사용률 ${Math.round(s.pool.live.utilization * 100)}% (${s.pool.live.connectionsInUse}/${s.pool.config.poolMax}). ORACLE_POOL_MAX 상향 또는 느린 쿼리 정리가 필요합니다.` });
      const st = s.pool.stats;
      if (st && (num(st.currentQueueLength) > 0 || num(st.requestTimeouts) > 0)) out.push({ level: st.requestTimeouts ? 'crit' : 'warn', code: 'POOL_QUEUE', message: `풀 대기열 ${st.currentQueueLength}건, 대기 타임아웃 누적 ${st.requestTimeouts}건(NJS-040). 커넥션이 반납되지 않거나 DB 가 느립니다.` });
    } else if (s.pool.error) out.push({ level: 'warn', code: 'POOL_UNKNOWN', message: `풀 상태를 읽지 못했습니다: ${s.pool.error}` });

    const el = s.process.eventLoop;
    if (el && el.p99Ms >= T.eventLoopP99CritMs) out.push({ level: 'crit', code: 'LOOP_BLOCKED', message: `이벤트 루프 지연 p99 ${el.p99Ms}ms — 단일 프로세스가 막혀 모든 사용자가 같이 느려집니다(엑셀/대량 직렬화 의심).` });
    else if (el && el.p99Ms >= T.eventLoopP99WarnMs) out.push({ level: 'warn', code: 'LOOP_SLOW', message: `이벤트 루프 지연 p99 ${el.p99Ms}ms (경고 ${T.eventLoopP99WarnMs}ms).` });

    if (s.http.last5m.requests >= 20 && s.http.last5m.errorRate >= T.errorRateWarnPct) out.push({ level: 'warn', code: 'ERROR_RATE', message: `최근 5분 5xx 비율 ${s.http.last5m.errorRate}% (${s.http.last5m.errors}/${s.http.last5m.requests}).` });

    const heapRatio = s.process.memory.rssMb / s.process.memory.limitMb;
    if (heapRatio >= T.heapWarnRatio) out.push({ level: 'warn', code: 'MEMORY', message: `프로세스 메모리 ${s.process.memory.rssMb}MB / PM2 재시작 한도 ${s.process.memory.limitMb}MB (${Math.round(heapRatio * 100)}%).` });

    for (const l of s.db.limits ?? []) {
      if (l.limit && l.current / l.limit >= T.sessionUtilWarn) out.push({ level: 'warn', code: 'ORA_LIMIT', message: `Oracle ${l.resource} ${l.current}/${l.limit} (피크 ${l.max}) — 한도 접근.` });
    }
    if (s.db.sessions && s.db.sessions.blocked > 0) out.push({ level: 'warn', code: 'ORA_BLOCKED', message: `락 대기 세션 ${s.db.sessions.blocked}건 — 긴 트랜잭션이 다른 요청을 막고 있습니다.` });

    const nPlusOne = s.http.last15m.routes.filter((r) => r.avgQueries >= T.nPlusOneQueries).slice(0, 5);
    if (nPlusOne.length) out.push({ level: 'warn', code: 'N_PLUS_ONE', message: `요청당 쿼리 ${T.nPlusOneQueries}개 이상(N+1 의심): ${nPlusOne.map((r) => `${r.method} ${r.route} (${r.avgQueries})`).join(', ')}` });

    const polling = s.http.last15m.routes.filter((r) => r.perMinute >= T.pollingPerMinute).slice(0, 5);
    if (polling.length) out.push({ level: 'ok', code: 'POLLING', message: `폴링 부하 상위: ${polling.map((r) => `${r.route} ${r.perMinute}/분`).join(', ')} — 보드 캐시(5초) 대상.` });

    if (s.slowQueries.length) out.push({ level: 'warn', code: 'SLOW_SQL', message: `3초 초과 쿼리 ${s.slowQueries.length}건(최근). 아래 느린 쿼리 표를 확인하세요.` });

    if (!s.process.pm2.instance) out.push({ level: 'ok', code: 'SINGLE_PROCESS', message: '단일 프로세스(PM2 fork) 운영 중 — 클러스터 전환 시 @Cron 중복 실행 가드가 필요합니다.' });
    if (out.length === 0) out.push({ level: 'ok', code: 'HEALTHY', message: '모든 지표가 임계값 안에 있습니다.' });
    const rank: Record<AssessLevel, number> = { crit: 0, warn: 1, ok: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level]);
  }
}
