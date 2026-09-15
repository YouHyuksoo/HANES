import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * utils/scanned-order-no.ts 의 동작을 구조 테스트로 고정한다.
 * (프론트 단위테스트 러너가 없어 소스에서 함수 본문을 떼어내 평가한다)
 */
const source = readFileSync(new URL('./scanned-order-no.ts', import.meta.url), 'utf8');
const body = source
  .slice(source.indexOf('export function normalizeScannedOrderNo'))
  .replace('export function', 'function')
  // 타입 표기 제거 — new Function 은 순수 JS 만 평가한다
  .replace('normalizeScannedOrderNo(raw: string): string', 'normalizeScannedOrderNo(raw)');
const normalizeScannedOrderNo = new Function(`${body}; return normalizeScannedOrderNo;`)();

test('작업지시번호는 그대로 통과한다', () => {
  assert.equal(normalizeScannedOrderNo('WO2609110332'), 'WO2609110332');
  assert.equal(normalizeScannedOrderNo('  WO2609110332 \r\n'), 'WO2609110332');
});

test('예전 출력물의 조회 URL 에서 작업지시번호를 뽑는다', () => {
  assert.equal(
    normalizeScannedOrderNo('https://hswbs.haengsung.com/production/order?orderNo=WO2609110332'),
    'WO2609110332',
  );
  assert.equal(
    normalizeScannedOrderNo('http://localhost:3002/production/order?orderNo=WO2609110327&x=1'),
    'WO2609110327',
  );
});

test('orderNo 가 없는 URL 이나 빈 입력은 원문을 유지한다', () => {
  const noParam = 'https://hswbs.haengsung.com/production/order';
  assert.equal(normalizeScannedOrderNo(noParam), noParam);
  assert.equal(normalizeScannedOrderNo('   '), '');
});
