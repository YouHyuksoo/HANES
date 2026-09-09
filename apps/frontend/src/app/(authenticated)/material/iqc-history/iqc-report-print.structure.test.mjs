import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const modalUrl = new URL('./IqcReportPrintModal.tsx', import.meta.url);
const typesUrl = new URL('./iqcDetailTypes.ts', import.meta.url);
const detailUrl = new URL('./IqcDetailModal.tsx', import.meta.url);
const columnsUrl = new URL('./iqcHistoryColumns.tsx', import.meta.url);
const pageUrl = new URL('./page.tsx', import.meta.url);

test('IQC 성적서 인쇄 모달 파일이 존재한다', () => {
  assert.ok(existsSync(modalUrl), 'IqcReportPrintModal.tsx 없음');
  assert.ok(existsSync(typesUrl), 'iqcDetailTypes.ts 없음');
});

const modal = readFileSync(modalUrl, 'utf8');
const types = readFileSync(typesUrl, 'utf8');
const detail = readFileSync(detailUrl, 'utf8');
const columns = readFileSync(columnsUrl, 'utf8');
const page = readFileSync(pageUrl, 'utf8');

test('성적서 모달은 window.print + @media print(A4)로 출력한다', () => {
  assert.match(modal, /window\.print\(\)/);
  assert.match(modal, /@media print/);
  assert.match(modal, /@page \{ size: A4 portrait/);
  // 프린트 시 모달 크롬 숨김: 버튼 영역 print:hidden + 성적서 영역만 visible
  assert.match(modal, /print:hidden/);
  assert.match(modal, /visibility: hidden/);
});

test('성적서 모달은 설계서 8절 구성(머리/AQL 요약/시리얼별 항목 표/서명란/출력일시)을 갖는다', () => {
  assert.match(modal, /material\.iqcHistory\.report\.title/);
  assert.match(modal, /material\.iqcHistory\.report\.aqlSummary/);
  assert.match(modal, /material\.iqcHistory\.report\.serialItems/);
  assert.match(modal, /material\.iqcHistory\.report\.approver/);
  assert.match(modal, /material\.iqcHistory\.report\.printedAt/);
  // 시리얼별 항목 표 컬럼: 규격/하한/상한/단위/측정값/판정
  for (const key of ['detail.spec', 'detail.lsl', 'detail.usl', 'detail.measuredValue', 'detail.judge']) {
    assert.match(modal, new RegExp(`material\\.iqcHistory\\.${key.replace('.', '\\.')}`), `${key} 누락`);
  }
  assert.match(modal, /common\.unit/);
});

test('alert/confirm/prompt 및 파스텔 bg-*-50 배경을 사용하지 않는다', () => {
  for (const [name, src] of [['modal', modal], ['types', types], ['detail', detail], ['columns', columns]]) {
    assert.doesNotMatch(src, /\balert\(/, `${name}: alert 사용`);
    assert.doesNotMatch(src, /\bconfirm\(/, `${name}: confirm 사용`);
    assert.doesNotMatch(src, /\bprompt\(/, `${name}: prompt 사용`);
    assert.doesNotMatch(src, /\bas any\b/, `${name}: as any 사용`);
  }
  assert.doesNotMatch(modal, /bg-[a-z]+-50\b/, '파스텔 bg-*-50 사용');
});

test('DETAILS/ITEM_RESULTS 파싱은 iqcDetailTypes.ts 단일 출처를 공유한다', () => {
  assert.match(types, /export function parseIqcDetails\(/);
  assert.match(types, /export function parseIqcItemResults\(/);
  assert.match(types, /export interface IqcDetailRecord/);
  assert.match(modal, /from "\.\/iqcDetailTypes"/);
  assert.match(detail, /from "\.\/iqcDetailTypes"/);
  // 상세 모달에 인라인 JSON.parse 가 남아있지 않아야 한다
  assert.doesNotMatch(detail, /JSON\.parse\(/);
});

test('진입점: 그리드 프린터 아이콘 + 상세 모달 인쇄 버튼 + page 상태 연결', () => {
  assert.match(columns, /Printer/);
  assert.match(columns, /onPrintReport/);
  assert.match(columns, /material\.iqcHistory\.report\.printTooltip/);
  assert.match(detail, /onPrint/);
  assert.match(detail, /material\.iqcHistory\.report\.printButton/);
  assert.match(page, /import IqcReportPrintModal from "\.\/IqcReportPrintModal"/);
  assert.match(page, /onPrintReport: setPrintRecord/);
  assert.match(page, /<IqcReportPrintModal record=\{printRecord\}/);
  assert.match(page, /onPrint=\{setPrintRecord\}/);
});
