import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 시스템 상태 모니터(/system/health) — 100 세션 감당 여부를 보는 화면.
 * 지표 원천(인터셉터·풀 통계·V$ 뷰)과 화면 섹션, 메뉴 4소스, i18n 4언어를 고정한다.
 */
const repo = path.resolve(import.meta.dirname, "../../../../../../..");
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");

const page = read("apps/frontend/src/app/(authenticated)/system/health/page.tsx");
const store = read("apps/backend/src/common/metrics/request-metrics.store.ts");
const interceptor = read("apps/backend/src/common/interceptors/metrics.interceptor.ts");
const main = read("apps/backend/src/main.ts");
const service = read("apps/backend/src/modules/system/services/system-health.service.ts");
const controller = read("apps/backend/src/modules/system/controllers/system-health.controller.ts");
const logger = read("apps/backend/src/common/sql-debug/typeorm-sql-debug.logger.ts");
const poolEnv = read("apps/backend/src/database/oracle-env.ts");

test("요청 지표는 운영에서도 켜지는 MetricsInterceptor 가 SqlDebug 안쪽에서 모은다", () => {
  const sqlIdx = main.indexOf("new SqlDebugInterceptor()");
  const metricsIdx = main.indexOf("new MetricsInterceptor()");
  assert.ok(sqlIdx > 0 && metricsIdx > sqlIdx, "MetricsInterceptor 는 SqlDebugInterceptor 뒤에 등록해야 쿼리 수를 읽는다");
  assert.doesNotMatch(main.slice(metricsIdx - 200, metricsIdx), /if \(!isProduction\)/, "운영에서도 지표를 모아야 한다");
  assert.match(interceptor, /queries: getSqlDebugQueries\(\)\.length/);
  assert.match(interceptor, /userId: getRequestUser\(req\)\?\.id/);
  assert.match(interceptor, /export function normalizeRoute/);
  // 느린 쿼리는 TypeORM maxQueryExecutionTime 훅으로
  assert.match(logger, /requestMetricsStore\.recordSlowQuery\(time, query\)/);
  // 링 버퍼 상한
  assert.match(store, /MAX_REQUESTS = 5000/);
  assert.match(store, /monitorEventLoopDelay/);
});

test("스냅샷은 풀·Oracle 세션·요청 구간·프로세스를 모으고 임계값으로 판정한다", () => {
  assert.match(controller, /@Controller\('system\/health'\)/);
  assert.match(controller, /@Roles\('ADMIN'\)/);
  assert.match(controller, /@Get\('snapshot'\)/);
  assert.match(service, /export const THRESHOLDS = \{/);
  assert.match(service, /pool\.getStatistics/);
  assert.match(poolEnv, /enableStatistics: true/);
  assert.match(service, /FROM V\$SESSION/);
  assert.match(service, /FROM V\$RESOURCE_LIMIT/);
  assert.match(service, /summarize\(60_000\)[\s\S]*summarize\(5 \* 60_000\)[\s\S]*summarize\(15 \* 60_000\)/);
  for (const code of ["DB_DOWN", "DB_SLOW", "POOL_HOT", "POOL_QUEUE", "LOOP_BLOCKED", "ERROR_RATE", "MEMORY", "ORA_LIMIT", "ORA_BLOCKED", "N_PLUS_ONE", "POLLING", "SLOW_SQL", "SINGLE_PROCESS"]) {
    assert.match(service, new RegExp(`code: '${code}'`), `판정 코드 ${code}`);
  }
  // 캐스팅 대신 타입 가드
  assert.doesNotMatch(service, /as unknown as/);
});

test("화면은 판정 띠·핵심 지표 띠·풀·Oracle·부하·느린쿼리·에러·프로세스 섹션을 갖고 카드 그리드를 쓰지 않는다", () => {
  assert.match(page, /\/system\/health\/snapshot/);
  assert.match(page, /refetchInterval: paused \? false : refetchSec \* 1000/);
  for (const id of ["health-assessments", "health-kpi-strip", "health-pool-bar", "health-oracle", "health-load-grid", "health-process"]) {
    assert.match(page, new RegExp(`data-testid="${id}"`), id);
  }
  assert.match(page, /thresholds/);
  assert.doesNotMatch(page, /StatCard/, "AI 카드박스 그리드 대신 타이포 지표 띠를 쓴다");
  assert.doesNotMatch(page, /bg-(green|red|amber|blue)-(50|100)\b/, "파스텔 배경 금지");
});

test("메뉴 4소스와 i18n 4언어에 SYS_HEALTH 가 있다", () => {
  assert.match(read("apps/frontend/src/config/menuConfig.ts"), /SYS_HEALTH[\s\S]{0,80}\/system\/health/);
  assert.match(read("apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts"), /'SYS_HEALTH'/);
  const seed = JSON.parse(read("apps/backend/src/seeds/menu-config.json"));
  assert.ok(seed.childMenuCodes.SYSTEM.includes("SYS_HEALTH"));
  assert.match(read("apps/frontend/src/components/layout/pageRegistry.generated.ts"), /\/system\/health/);
  for (const lang of ["ko", "en", "zh", "vi"]) {
    const j = JSON.parse(read(`apps/frontend/src/locales/${lang}.json`));
    assert.equal(typeof j.menu["system.health"], "string", `${lang} menu`);
    const h = j.system.health;
    for (const k of ["title", "subtitle", "pause", "resume", "interval", "updatedAt"]) assert.equal(typeof h[k], "string", `${lang} ${k}`);
    for (const k of ["assess", "kpi", "pool", "oracle", "load", "slow", "errors", "process", "help"]) assert.equal(typeof h.sections[k], "string", `${lang} sections.${k}`);
    for (const k of ["activeUsers", "rps", "errorRate", "p95", "dbPing", "loop", "pool"]) assert.equal(typeof h.kpi[k], "string", `${lang} kpi.${k}`);
    for (const k of ["h1", "h2", "h3", "h4", "h5", "h6"]) assert.equal(typeof h.help[k], "string", `${lang} help.${k}`);
  }
});
