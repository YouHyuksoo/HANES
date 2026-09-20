/**
 * @file common/metrics/request-metrics.store.spec.ts
 * @description 요청 지표 저장소 — 구간 집계(초당 요청·에러율·p95·활성 사용자), 엔드포인트별 폴링/N+1 신호, 링 버퍼 상한
 */
import { RequestMetricsStore, type RequestSample } from './request-metrics.store';

function sample(over: Partial<RequestSample> & { at: number }): RequestSample {
  return { method: 'GET', route: '/x', status: 200, ms: 10, queries: 1, ...over };
}

describe('RequestMetricsStore.summarize', () => {
  it('구간 안의 요청만 집계하고 초당 요청·에러율·p50/p95·활성 사용자를 계산한다', () => {
    let now = 1_000_000;
    const store = new RequestMetricsStore(() => now);
    now += 120_000; // 부팅 후 2분 지난 상태
    // 1분 창 밖(70초 전)
    store.record(sample({ at: now - 70_000, userId: 'old' }));
    // 1분 창 안 10건: 5xx 1건, 사용자 3명, IP 2개
    for (let i = 0; i < 10; i++) {
      store.record(sample({ at: now - i * 1000, ms: (i + 1) * 10, userId: `u${i % 3}`, ip: `ip${i % 2}`, status: i === 9 ? 500 : 200 }));
    }
    const s = store.summarize(60_000);
    expect(s.requests).toBe(10);
    expect(s.rps).toBe(0.2); // 10건 / 60초
    expect(s.errors).toBe(1);
    expect(s.errorRate).toBe(10);
    expect(s.p50Ms).toBe(50);
    expect(s.p95Ms).toBe(100);
    expect(s.maxMs).toBe(100);
    expect(s.activeUsers).toBe(3);
    expect(s.activeIps).toBe(2);
    // 15분 창은 창 밖 1건도 포함
    expect(store.summarize(15 * 60_000).requests).toBe(11);
  });

  it('부팅 직후에는 실제 관측 시간으로 초당 요청을 계산한다(과소평가 방지)', () => {
    let now = 5_000_000;
    const store = new RequestMetricsStore(() => now);
    now += 10_000; // 부팅 10초 뒤
    for (let i = 0; i < 5; i++) store.record(sample({ at: now - i * 1000 }));
    expect(store.summarize(60_000).rps).toBe(0.5); // 5건 / 10초
  });

  it('엔드포인트별 분당 호출·요청당 쿼리로 폴링과 N+1 을 드러낸다', () => {
    let now = 9_000_000;
    const store = new RequestMetricsStore(() => now);
    now += 15 * 60_000;
    for (let i = 0; i < 90; i++) store.record(sample({ at: now - i * 10_000, route: '/equipment/stop/open', queries: 1 }));
    for (let i = 0; i < 3; i++) store.record(sample({ at: now - i * 1000, route: '/production/list', queries: 12 + i, ms: 300 }));
    const s = store.summarize(15 * 60_000);
    const polling = s.routes.find((r) => r.route === '/equipment/stop/open');
    const nPlusOne = s.routes.find((r) => r.route === '/production/list');
    expect(polling?.count).toBe(90);
    expect(polling?.perMinute).toBe(6);
    expect(nPlusOne?.avgQueries).toBe(13);
    expect(nPlusOne?.maxQueries).toBe(14);
    expect(nPlusOne?.p95Ms).toBe(300);
    // 호출 많은 순으로 정렬
    expect(s.routes[0].route).toBe('/equipment/stop/open');
  });

  it('요청·느린쿼리·에러 링 버퍼는 상한을 넘기지 않고 최근 것부터 돌려준다', () => {
    const store = new RequestMetricsStore(() => 1);
    for (let i = 0; i < 5200; i++) store.record(sample({ at: 1, status: i % 50 === 0 ? 503 : 200, error: i % 50 === 0 ? `e${i}` : undefined }));
    expect(store.summarize(60_000).requests).toBe(5000);
    expect(store.recentErrors(200).length).toBe(100);
    expect(store.recentErrors(1)[0].error).toBe('e5150');
    for (let i = 0; i < 150; i++) store.recordSlowQuery(3000 + i, `SELECT   ${i}\n FROM DUAL`);
    const slow = store.recentSlowQueries(200);
    expect(slow.length).toBe(100);
    expect(slow[0]).toMatchObject({ ms: 3149, sql: 'SELECT 149 FROM DUAL' });
  });

  it('이벤트 루프 측정을 켜기 전에는 null 이다', () => {
    const store = new RequestMetricsStore();
    expect(store.eventLoop()).toBeNull();
  });
});
