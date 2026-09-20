/**
 * @file common/metrics/request-metrics.store.ts
 * @description 프로세스 내 요청·쿼리 지표 저장소 — 시스템 상태 모니터(/system/health)의 데이터 원천
 *
 * 초보자 가이드:
 * 1. MetricsInterceptor 가 요청마다 record() 로 1건씩 넣는다(경로 패턴, 상태, 소요ms, 실행 쿼리 수, 사용자).
 * 2. TypeORM 로거가 maxQueryExecutionTime(3초) 을 넘긴 쿼리를 recordSlowQuery() 로 넣는다.
 * 3. summarize(windowMs) 가 최근 구간을 집계한다 — 초당 요청, 에러율, p95, 엔드포인트별 부하(폴링 감지),
 *    요청당 쿼리 수(N+1 의심), 활성 사용자 수(구간 내 distinct userId).
 * 4. 링 버퍼라 메모리는 상한이 있다(요청 5,000건 · 느린쿼리 100건 · 에러 100건). 외부 저장소 없음 → 프로세스 재시작 시 초기화.
 *    PM2 클러스터로 가면 인스턴스별 값이므로 화면에 instance 를 같이 보여준다.
 */
import { monitorEventLoopDelay, type IntervalHistogram } from 'perf_hooks';

export interface RequestSample {
  at: number;
  method: string;
  route: string;
  status: number;
  ms: number;
  queries: number;
  userId?: string;
  ip?: string;
  error?: string;
}

export interface SlowQuerySample {
  at: number;
  ms: number;
  sql: string;
}

export interface RouteStat {
  method: string;
  route: string;
  count: number;
  perMinute: number;
  errors: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  avgQueries: number;
  maxQueries: number;
}

export interface WindowSummary {
  windowSec: number;
  requests: number;
  rps: number;
  errors: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  activeUsers: number;
  activeIps: number;
  routes: RouteStat[];
}

export interface EventLoopStat {
  meanMs: number;
  p50Ms: number;
  p99Ms: number;
  maxMs: number;
}

const MAX_REQUESTS = 5000;
const MAX_SLOW = 100;
const MAX_ERRORS = 100;
const MAX_SQL_LEN = 400;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export class RequestMetricsStore {
  private readonly requests: RequestSample[] = [];
  private readonly slowQueries: SlowQuerySample[] = [];
  private readonly errors: RequestSample[] = [];
  private readonly startedAt: number;
  private histogram: IntervalHistogram | null = null;

  constructor(private readonly now: () => number = () => Date.now()) {
    this.startedAt = this.now();
  }

  /** 이벤트 루프 지연 측정 시작 — 앱 부팅 시 한 번 */
  enableEventLoopMonitor(): void {
    if (this.histogram) return;
    this.histogram = monitorEventLoopDelay({ resolution: 20 });
    this.histogram.enable();
  }

  record(sample: RequestSample): void {
    this.requests.push(sample);
    if (this.requests.length > MAX_REQUESTS) this.requests.splice(0, this.requests.length - MAX_REQUESTS);
    if (sample.status >= 500 || sample.error) {
      this.errors.push(sample);
      if (this.errors.length > MAX_ERRORS) this.errors.splice(0, this.errors.length - MAX_ERRORS);
    }
  }

  recordSlowQuery(ms: number, sql: string): void {
    this.slowQueries.push({ at: this.now(), ms, sql: sql.replace(/\s+/g, ' ').trim().slice(0, MAX_SQL_LEN) });
    if (this.slowQueries.length > MAX_SLOW) this.slowQueries.splice(0, this.slowQueries.length - MAX_SLOW);
  }

  /** 최근 windowMs 구간 집계 */
  summarize(windowMs: number, topRoutes = 30): WindowSummary {
    const since = this.now() - windowMs;
    const windowSec = windowMs / 1000;
    // 실제 관측 구간: 부팅 직후엔 windowMs 보다 짧다 → rps 가 과소평가되지 않게 보정
    const observedSec = Math.max(1, Math.min(windowSec, (this.now() - this.startedAt) / 1000));
    const rows = this.requests.filter((r) => r.at >= since);
    const durations = rows.map((r) => r.ms).sort((a, b) => a - b);
    const errors = rows.filter((r) => r.status >= 500 || r.error).length;

    const byRoute = new Map<string, RequestSample[]>();
    for (const r of rows) {
      const key = `${r.method} ${r.route}`;
      const list = byRoute.get(key);
      if (list) list.push(r);
      else byRoute.set(key, [r]);
    }
    const routes: RouteStat[] = [...byRoute.entries()].map(([, list]) => {
      const d = list.map((r) => r.ms).sort((a, b) => a - b);
      const q = list.map((r) => r.queries);
      return {
        method: list[0].method,
        route: list[0].route,
        count: list.length,
        perMinute: round1(list.length / (observedSec / 60)),
        errors: list.filter((r) => r.status >= 500 || r.error).length,
        avgMs: round1(d.reduce((s, v) => s + v, 0) / d.length),
        p95Ms: percentile(d, 95),
        maxMs: d[d.length - 1],
        avgQueries: round1(q.reduce((s, v) => s + v, 0) / q.length),
        maxQueries: Math.max(...q),
      };
    });
    routes.sort((a, b) => b.count - a.count);

    return {
      windowSec,
      requests: rows.length,
      rps: round1(rows.length / observedSec),
      errors,
      errorRate: rows.length ? round1((errors / rows.length) * 100) : 0,
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      maxMs: durations[durations.length - 1] ?? 0,
      activeUsers: new Set(rows.map((r) => r.userId).filter(Boolean)).size,
      activeIps: new Set(rows.map((r) => r.ip).filter(Boolean)).size,
      routes: routes.slice(0, topRoutes),
    };
  }

  recentSlowQueries(limit = 30): SlowQuerySample[] {
    return this.slowQueries.slice(-limit).reverse();
  }

  recentErrors(limit = 30): RequestSample[] {
    return this.errors.slice(-limit).reverse();
  }

  /** 이벤트 루프 지연(ms). 읽은 뒤 리셋해 다음 조회는 그 사이 구간을 본다 */
  eventLoop(): EventLoopStat | null {
    const h = this.histogram;
    if (!h) return null;
    const toMs = (ns: number) => round1(ns / 1e6);
    const stat = { meanMs: toMs(h.mean || 0), p50Ms: toMs(h.percentile(50)), p99Ms: toMs(h.percentile(99)), maxMs: toMs(h.max) };
    h.reset();
    return stat;
  }
}

/** 프로세스 단일 인스턴스 — 인터셉터·TypeORM 로거·헬스 서비스가 같은 객체를 쓴다 */
export const requestMetricsStore = new RequestMetricsStore();
