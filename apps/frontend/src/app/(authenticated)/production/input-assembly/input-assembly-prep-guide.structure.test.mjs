import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('조립 준비 안내 단계는 순수 함수가 계산하고 공용 배정 규칙을 쓴다(반제품 스캔은 준비 단계가 아니다)', () => {
  const src = read('./assemblyPrepGuideSteps.ts');
  assert.match(src, /export function buildAssemblyPrepGuideSteps/, '단계 계산 순수 함수가 있어야 한다');
  for (const key of ['"equip"', '"jobOrder"', '"worker"', '"daily"', '"workerInspect"']) {
    assert.match(src, new RegExp(key), `${key} 단계가 있어야 한다`);
  }
  assert.doesNotMatch(src, /"sgScan"|"materialScan"/, '반제품 스캔은 FG마다 반복하는 본작업이라 준비 단계에 넣지 않는다');
  assert.match(src, /assignPrepGuideStatuses\(raw\)/, '배정 규칙은 공용 assignPrepGuideStatuses를 써야 한다');
  assert.match(src, /notTarget: !dailyInspectRequired/, '환경설정으로 꺼진 점검은 notTarget이어야 한다');
  assert.match(src, /notTarget: !workerInspectRequired/, '환경설정으로 꺼진 점검은 notTarget이어야 한다');
});

test('조립 안내는 공용 PrepGuideModal 위의 얇은 매핑이고 가공 키오스크 단계 문구를 재사용한다', () => {
  const src = read('./components/AssemblyPrepGuideModal.tsx');
  assert.match(src, /PrepGuideModal/, '공용 PrepGuideModal을 써야 한다');
  assert.doesNotMatch(src, /createPortal/, '포탈·레이아웃은 공용 모달이 담당한다');
  assert.match(src, /testIdPrefix="assembly-guide"/, '테스트 ID 접두어가 assembly-guide여야 한다');
  assert.match(src, /kiosk\.guide\.stepEquip/, '단계 라벨은 kiosk.guide.*를 재사용한다');
  assert.match(src, /production\.inputAssembly\.guide\.title/, '제목은 조립 화면 것');
  assert.doesNotMatch(src, /api\.(get|post|patch)/, '안내 모달이 API를 직접 부르지 않는다');
});

test('페이지가 공용 훅으로 안내를 띄우고 상단 바에 다시 열기 버튼이 있다', () => {
  const page = read('./page.tsx');
  assert.match(page, /AssemblyPrepGuideModal/, '안내 모달을 렌더해야 한다');
  assert.match(page, /usePrepGuide\(guideSteps\)/, '공용 usePrepGuide를 써야 한다');
  assert.match(page, /buildAssemblyPrepGuideSteps\(/, '단계는 순수 함수로 계산해야 한다');
  assert.match(page, /assembly-guide-open/, '상단 바에 안내 다시 열기 버튼이 있어야 한다');
  assert.match(page, /onOpenEquipSelect=\{\(\) => setEquipModalOpen\(true\)\}/, '설비 선택은 상단 바와 같은 모달을 연다');
  assert.match(page, /onOpenJobOrder=\{\(\) => setOrderSearchOpen\(true\)\}/, '작업지시는 상단 바와 같은 모달을 연다');
});

test('조립 화면은 출력 대차 슬롯을 두고 확정에 carrierNo를 싣는다', () => {
  const page = read('./page.tsx');
  const steps = read('./assemblyPrepGuideSteps.ts');
  assert.match(page, /<OutputCarrierSlot/);
  assert.match(page, /carrierNo: outputCarrier\.carrier\?\.carrierNo \?\? undefined/);
  assert.match(steps, /"carrier"/);
});

test('i18n 4개 언어에 production.inputAssembly.guide 키가 모두 있다', () => {
  const required = ['title', 'subtitle', 'allReadyDesc', 'hintEquip', 'hintJobOrder'];
  for (const lang of ['ko', 'en', 'zh', 'vi']) {
    const json = JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8'));
    const guide = json.production?.inputAssembly?.guide;
    assert.ok(guide, `${lang}: production.inputAssembly.guide 가 있어야 한다`);
    for (const key of required) assert.equal(typeof guide[key], 'string', `${lang}: guide.${key} 누락`);
  }
});
