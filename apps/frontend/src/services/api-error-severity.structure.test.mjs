import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const severity = readFileSync(new URL('./api-error-severity.ts', import.meta.url), 'utf8');
const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const store = readFileSync(new URL('../stores/errorStore.ts', import.meta.url), 'utf8');
const feedback = readFileSync(new URL('../components/shared/ApiFeedbackModal.tsx', import.meta.url), 'utf8');
const notice = readFileSync(new URL('../components/shared/ApiNoticeModal.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../components/shared/ErrorDetailModal.tsx', import.meta.url), 'utf8');
const providers = readFileSync(new URL('../app/providers.tsx', import.meta.url), 'utf8');

test('업무 안내로 분류하는 상태코드는 400/403/404/409/422', () => {
  const match = severity.match(/NOTICE_STATUSES = new Set\(\[([^\]]+)\]\)/);
  assert.ok(match, 'NOTICE_STATUSES 정의를 찾지 못했다');
  const codes = match[1].split(',').map((v) => v.trim()).filter(Boolean);
  assert.deepEqual(codes.sort(), ['400', '403', '404', '409', '422']);
});

test('시스템 오류 errorCode는 상태코드보다 우선한다', () => {
  for (const code of ['INTERNAL_SERVER_ERROR', 'UNKNOWN_ERROR', 'DB_CONNECTION_ERROR']) {
    assert.match(severity, new RegExp(`"${code}"`));
  }
  // errorCode 검사가 NOTICE_STATUSES 검사보다 앞에 있어야 한다
  const fn = severity.slice(severity.indexOf('export function classifyApiError'));
  assert.ok(
    fn.indexOf('SYSTEM_ERROR_CODES.has') < fn.indexOf('NOTICE_STATUSES.has'),
    'errorCode 판정이 상태코드 판정보다 먼저여야 한다',
  );
});

test('분류되지 않은 상태코드는 시스템 오류로 떨어진다', () => {
  const fn = severity.slice(severity.indexOf('export function classifyApiError'));
  assert.match(fn, /return "system";\s*\n\}/);
});

test('api 인터셉터가 severity를 채워 showError를 호출한다', () => {
  assert.match(api, /import \{ classifyApiError \} from ".\/api-error-severity"/);
  // 네트워크 실패는 항상 시스템 오류
  assert.match(api, /severity: "system"/);
  // HTTP 에러는 status + errorCode로 분류
  assert.match(api, /severity: classifyApiError\(status, errorCode\)/);
});

test('errorStore가 severity를 보관한다', () => {
  assert.match(store, /severity: ApiErrorSeverity/);
  assert.match(store, /errorCode\?: string/);
});

test('ApiFeedbackModal이 유일한 구독자이며 배타적으로 분기한다', () => {
  assert.match(feedback, /useErrorStore/);
  assert.match(feedback, /error\.severity === "notice"/);
  assert.match(feedback, /<ApiNoticeModal/);
  assert.match(feedback, /<ErrorDetailModal/);
  // 두 창은 스스로 store를 구독하지 않는다 (이중 표시 방지)
  assert.doesNotMatch(notice, /useErrorStore/);
  assert.doesNotMatch(detail, /useErrorStore/);
});

test('providers는 ApiFeedbackModal만 마운트한다', () => {
  assert.match(providers, /<ApiFeedbackModal \/>/);
  assert.doesNotMatch(providers, /<ErrorDetailModal \/>/);
});

test('안내 창은 시스템 오류 창과 다른 정보량/톤을 가진다', () => {
  // 복사 버튼·응답 전문 없음 (장애 오해 유발 요소 제거)
  assert.doesNotMatch(notice, /responseBody/);
  assert.doesNotMatch(notice, /클립보드|navigator\.clipboard/);
  // 다중 줄 검증 메시지(class-validator)가 뭉개지지 않아야 한다
  assert.match(notice, /whitespace-pre-line/);
  // 파스텔 배경 금지 - 테두리/텍스트 색으로만 구분
  assert.doesNotMatch(notice, /bg-(amber|yellow|blue|red|green)-(50|100)\b/);
  // 시스템 오류 창은 복사 기능을 유지한다
  assert.match(detail, /navigator\.clipboard/);
});

// --- 실제 동작 검증 (Node type-stripping으로 .ts 직접 import) ---

const mod = await import('./api-error-severity.ts');
const { classifyApiError, getNoticeTitleKey, getNoticeHintKey } = mod;

test('업무 안내 상태코드는 notice로 분류된다', () => {
  for (const s of [400, 403, 404, 409, 422]) {
    assert.equal(classifyApiError(s), 'notice', `${s} → notice`);
  }
});

test('장애 상태코드와 네트워크 실패는 system으로 분류된다', () => {
  for (const s of [0, 500, 502, 503, 504]) {
    assert.equal(classifyApiError(s), 'system', `${s} → system`);
  }
});

test('시스템 errorCode는 notice 상태코드보다 우선한다', () => {
  assert.equal(classifyApiError(503, 'DB_CONNECTION_ERROR'), 'system');
  assert.equal(classifyApiError(400, 'INTERNAL_SERVER_ERROR'), 'system');
  assert.equal(classifyApiError(400, 'UNKNOWN_ERROR'), 'system');
  // 평범한 errorCode는 상태코드 판정을 바꾸지 않는다
  assert.equal(classifyApiError(400, 'HTTP_400'), 'notice');
});

test('분류표에 없는 상태코드는 system으로 떨어진다', () => {
  assert.equal(classifyApiError(429), 'system');
  assert.equal(classifyApiError(418), 'system');
});

test('안내 문구는 i18n 키로 반환되고 상태코드별로 갈린다', () => {
  assert.equal(getNoticeTitleKey(409), 'apiNotice.title.conflict');
  assert.equal(getNoticeTitleKey(403), 'apiNotice.title.forbidden');
  assert.equal(getNoticeTitleKey(404), 'apiNotice.title.notFound');
  assert.equal(getNoticeTitleKey(400), getNoticeTitleKey(422));
  assert.notEqual(getNoticeTitleKey(409), getNoticeTitleKey(400));
  assert.equal(getNoticeHintKey(429), 'apiNotice.hint.default');
  // 표시 문구를 소스에 되돌려 넣지 못하게 막는다 (i18n 단일 출처)
  assert.doesNotMatch(severity, /return "[^"]*[가-힣][^"]*";/u);
});

test('4개 로케일에 apiNotice 키가 모두 존재한다', async () => {
  const langs = ['ko', 'en', 'zh', 'vi'];
  const titleKeys = ['invalidInput', 'forbidden', 'notFound', 'conflict', 'default'];
  for (const lang of langs) {
    const url = new URL(`../locales/${lang}.json`, import.meta.url);
    const raw = readFileSync(url, 'utf8');
    assert.ok(!raw.startsWith('﻿'), `${lang}.json에 BOM이 있으면 안 된다`);
    const json = JSON.parse(raw);
    assert.ok(json.apiNotice, `${lang}: apiNotice 누락`);
    for (const k of titleKeys) {
      assert.ok(json.apiNotice.title[k], `${lang}: title.${k} 누락`);
      assert.ok(json.apiNotice.hint[k], `${lang}: hint.${k} 누락`);
    }
    for (const k of ['confirm', 'showDetail', 'hideDetail', 'close']) {
      assert.ok(json.apiNotice[k], `${lang}: ${k} 누락`);
    }
  }
});

test('안내 창은 하드코딩 문구 없이 t()로 렌더한다', () => {
  assert.match(notice, /useTranslation/);
  assert.match(notice, /t\(getNoticeTitleKey\(notice\.status\)\)/);
  assert.match(notice, /t\(getNoticeHintKey\(notice\.status\)\)/);
  assert.match(notice, /t\("apiNotice\.confirm"\)/);
});
