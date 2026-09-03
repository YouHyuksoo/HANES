/**
 * @file dashboard-value-stream.structure.test.mjs
 * @description 대시보드 가치흐름 구조 테스트 — 페이지 얇기, 데이터 소스, 디자인 금지 규칙, i18n 4언어 키 동기화
 * 실행: node --test "apps/frontend/src/app/(authenticated)/dashboard/dashboard-value-stream.structure.test.mjs"
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(__dirname, p), "utf8");

const page = read("page.tsx");
const hook = read("components/useDashboardData.ts");
const attention = read("components/buildAttention.ts");

// 1. 페이지는 배선만: 데이터 훅/큐 빌더를 소비하고, 구 카드 컴포넌트를 쓰지 않는다
assert.match(page, /useDashboardData\(\)/);
assert.match(page, /buildAttention\(data\)/);
assert.doesNotMatch(page, /InspectSummaryCard|StatusCard/, "구 카드 그리드 컴포넌트를 사용하면 안 됩니다.");
assert.ok(!existsSync(join(__dirname, "components/InspectSummaryCard.tsx")), "구 InspectSummaryCard 는 삭제되어야 합니다.");

// 2. 데이터 소스: 기존 API 4개만 사용 (백엔드 변경 없음)
for (const url of ['"/dashboard/summary"', '"/monitoring/boards/production"', '"/monitoring/boards/quality"', '"/monitoring/boards/inventory"']) {
  assert.match(hook, new RegExp(url.replace(/[/]/g, "\\/")), `${url} 호출이 있어야 합니다.`);
}
assert.match(hook, /Promise\.allSettled/, "일부 API 실패 시에도 나머지를 표시해야 합니다.");
assert.match(hook, /getTodayLocal/, "오늘 날짜는 로컬 기준 헬퍼를 써야 합니다 (toISOString 금지).");
assert.doesNotMatch(hook, /toISOString\(\)/);

// 3. 조치 큐: 심각도 정렬 + 0건 제외
assert.match(attention, /critical: 0, high: 1, medium: 2, low: 3/);
assert.match(attention, /\.sort\(/);
for (const key of ["equipStop", "inspectFail", "inspectNotDone", "defectWait", "expiredLot", "holdStock", "shortage", "nearExpiry", "holdOrder", "repairWait"]) {
  assert.match(attention, new RegExp(`key: "${key}"`), `조치 항목 ${key} 가 있어야 합니다.`);
}

// 4. 디자인 규칙: 파스텔 배경·hex 리터럴·그라디언트 카드 금지, 의미 토큰만
const componentDir = join(__dirname, "components");
const sources = readdirSync(componentDir).filter((f) => f.endsWith(".tsx")).map((f) => [f, read(`components/${f}`)]);
sources.push(["page.tsx", page]);
for (const [name, src] of sources) {
  assert.doesNotMatch(src, /bg-[a-z]+-50\b/, `${name}: 파스텔 -50 배경 금지`);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b/, `${name}: hex 색상 리터럴 금지 (의미 토큰 사용)`);
  assert.doesNotMatch(src, /bg-gradient-to/, `${name}: 그라디언트 카드 금지`);
  assert.doesNotMatch(src, /\balert\(|\bconfirm\(|\bprompt\(/, `${name}: 브라우저 다이얼로그 금지`);
}

// 5. i18n: 4언어 dashboard 블록 키 구조 동일
const localeDir = join(__dirname, "../../../locales");
const keysOf = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const ko = JSON.parse(readFileSync(join(localeDir, "ko.json"), "utf8"));
const koKeys = keysOf(ko.dashboard).sort();
for (const lang of ["en", "zh", "vi"]) {
  const raw = readFileSync(join(localeDir, `${lang}.json`), "utf8");
  assert.ok(!raw.startsWith("﻿"), `${lang}.json 에 BOM 금지`);
  const other = JSON.parse(raw);
  assert.deepEqual(keysOf(other.dashboard).sort(), koKeys, `${lang}.json dashboard 키가 ko 와 달라야 하지 않습니다.`);
}

// 6. 코드에서 쓰는 dashboard.* 키가 ko 에 존재
const allSrc = sources.map(([, s]) => s).join("\n");
const used = new Set([...allSrc.matchAll(/t\(\s*["'`](dashboard\.[a-zA-Z.]+)["'`]/g)].map((m) => m[1]));
const koSet = new Set(koKeys.map((k) => `dashboard.${k}`));
for (const k of used) assert.ok(koSet.has(k), `ko.json 에 ${k} 키가 없습니다.`);
// 동적 키(dashboard.stream.{key}, {key}Hero, dashboard.attention.{key}, dashboard.inspect.{kind})
for (const s of ["receive", "material", "production", "quality", "product"]) {
  assert.ok(koSet.has(`dashboard.stream.${s}`) && koSet.has(`dashboard.stream.${s}Hero`), `stream ${s} 키 누락`);
}
for (const k of ["daily", "periodic", "pm"]) assert.ok(koSet.has(`dashboard.inspect.${k}`), `inspect ${k} 키 누락`);
for (const k of ["equipStop", "inspectFail", "inspectNotDone", "defectWait", "expiredLot", "holdStock", "shortage", "nearExpiry", "holdOrder", "repairWait"]) {
  assert.ok(koSet.has(`dashboard.attention.${k}`), `attention ${k} 키 누락`);
}

console.log("dashboard value-stream structure ok");
