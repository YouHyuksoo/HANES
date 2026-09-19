import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('키오스크 준비 안내 단계는 순수 함수가 kioskStore 상태로 계산하고 공용 배정 규칙을 쓴다', () => {
  const src = read('./utils/kioskPrepGuideSteps.ts');
  assert.match(src, /export function buildKioskPrepGuideSteps/, '단계 계산 순수 함수가 있어야 한다');
  for (const key of ['"equip"', '"jobOrder"', '"worker"', '"daily"', '"workerInspect"', '"materialScan"', '"consumableScan"']) {
    assert.match(src, new RegExp(key), `${key} 단계가 있어야 한다`);
  }
  assert.match(src, /assignPrepGuideStatuses\(raw\)/, '배정 규칙은 공용 assignPrepGuideStatuses를 써야 한다');
  assert.match(src, /interlock\.dailyInspectDone/, '점검 완료는 헤더와 같은 interlock을 써야 한다');
  assert.match(src, /interlock\.materialScanDone/, '자재 스캔 완료는 interlock을 써야 한다');
});

test('키오스크 안내는 공용 PrepGuideModal 위의 얇은 매핑이고 모든 실행은 페이지의 같은 모달을 연다', () => {
  const src = read('./components/KioskPrepGuideModal.tsx');
  assert.match(src, /PrepGuideModal/, '공용 PrepGuideModal을 써야 한다');
  assert.doesNotMatch(src, /createPortal/, '포탈·레이아웃은 공용 모달이 담당한다');
  assert.match(src, /testIdPrefix="kiosk-guide"/, '테스트 ID 접두어가 kiosk-guide여야 한다');
  for (const prop of ['onOpenEquipSelect', 'onOpenJobOrder', 'onOpenWorker', 'onOpenDailyInspect', 'onOpenWorkerInspect', 'onOpenMaterialScan', 'onOpenConsumableScan']) {
    assert.match(src, new RegExp(prop), `${prop} 실행 핸들러를 받아야 한다`);
  }
  assert.doesNotMatch(src, /api\.(get|post|patch)/, '안내 모달이 API를 직접 부르지 않는다');
});

test('페이지가 공용 훅으로 안내를 띄우고 헤더의 설비 선택 모달을 제어한다', () => {
  const page = read('./page.tsx');
  assert.match(page, /KioskPrepGuideModal/, '안내 모달을 렌더해야 한다');
  assert.match(page, /usePrepGuide\(guideSteps\)/, '공용 usePrepGuide를 써야 한다');
  assert.match(page, /buildKioskPrepGuideSteps\(/, '단계는 순수 함수로 계산해야 한다');
  assert.match(page, /equipSelectOpen=\{isEquipSelectOpen\}/, '설비 선택 모달 열림을 페이지가 제어해야 한다');
  assert.match(page, /onOpenGuide=\{guide\.openGuide\}/, '헤더에 안내 다시 열기를 넘겨야 한다');
  const header = read('./components/EquipHeader.tsx');
  assert.match(header, /equipSelectOpen\?:/, '헤더는 설비 선택 열림을 controlled로 받을 수 있어야 한다');
  assert.match(header, /onEquipSelectOpenChange\?:/, '헤더는 열림 변경을 부모에 알려야 한다');
  assert.match(header, /kiosk-guide-open/, '헤더에 안내 다시 열기 버튼이 있어야 한다');
  // Row1 축약 규칙: 2xl 미만은 아이콘 정사각, 2xl 이상은 라벨을 펼친다
  const btn = header.slice(header.indexOf('data-testid="kiosk-guide-open"'), header.indexOf('data-testid="kiosk-guide-open"') + 700);
  assert.match(btn, /h-11 w-11/, '안내 버튼은 좁을 때 아이콘 정사각이어야 한다');
  assert.match(btn, /2xl:w-auto 2xl:px-3/, '넓을 때는 폭을 연다');
  assert.match(btn, /hidden whitespace-nowrap text-sm font-bold 2xl:inline/, '넓을 때는 라벨을 보여준다');
});

test('키오스크는 출력 대차 슬롯을 헤더에 두고 실적 저장에 carrierNo를 싣는다', () => {
  const page = read('./page.tsx');
  const header = read('./components/EquipHeader.tsx');
  const bar = read('./components/ProductionInputBar.tsx');
  const steps = read('./utils/kioskPrepGuideSteps.ts');
  assert.match(page, /useCarrierProcessFlags\(/);
  assert.match(page, /useOutputCarrier\(/);
  assert.match(header, /<OutputCarrierSlot/);
  assert.match(bar, /carrierNo: outputCarrierNo \?\? undefined/);
  assert.match(bar, /onCapacityRejected/);
  assert.match(steps, /"carrier"/);
  assert.match(steps, /notTarget: !carrierRequired/);
});

test('i18n 4개 언어에 kiosk.guide 키가 모두 있다', () => {
  const required = [
    'title', 'subtitle', 'allReadyDesc',
    'stepEquip', 'stepJobOrder', 'stepWorker', 'stepDaily', 'stepWorkerInspect', 'stepCarrier', 'stepMaterialScan', 'stepConsumableScan',
    'hintEquip', 'hintJobOrder', 'hintWorker', 'hintDaily', 'hintWorkerInspect', 'hintCarrier', 'hintMaterialScan', 'hintConsumableScan',
  ];
  for (const lang of ['ko', 'en', 'zh', 'vi']) {
    const json = JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8'));
    const guide = json.kiosk?.guide;
    assert.ok(guide, `${lang}: kiosk.guide 가 있어야 한다`);
    for (const key of required) assert.equal(typeof guide[key], 'string', `${lang}: kiosk.guide.${key} 누락`);
  }
});
