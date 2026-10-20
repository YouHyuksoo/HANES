import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('terminal inspection menu stays registered (label changed to 절압물검사)', () => {
  const menu = read('apps/frontend/src/config/menuConfig.ts');
  assert.match(menu, /INSP_TERMINAL_RESULT/);
  assert.match(menu, /menu\.inspection\.terminalResult/);
  assert.match(menu, /\/inspection\/terminal-result/);
});

test('절압물검사 page uses crimp job orders, not the FG label station workflow', () => {
  const page = read('apps/frontend/src/app/(authenticated)/inspection/terminal-result/page.tsx');
  assert.doesNotMatch(page, /InspectionResultWorkflow/);
  assert.match(page, /\/quality\/crimp-inspect\/job-orders/);
  assert.match(page, /CrimpInspectPanel/);

  const panel = read('apps/frontend/src/app/(authenticated)/inspection/terminal-result/components/CrimpInspectPanel.tsx');
  assert.match(panel, /\/quality\/crimp-inspect\/context/);
  assert.match(panel, /api\.post\("\/quality\/crimp-inspect"/);
  // 판정 기준은 shared 함수 하나 — 서버도 같은 judgeCrimpSide 계열을 쓴다
  assert.match(panel, /isCrimpValueInSpec/);
  assert.match(panel, /crimpMeasureTargets/);
  assert.doesNotMatch(panel, /fgBarcode|circuitLabel/);
});

test('키패드 보기를 켜면 우측 터치 키패드가 선택한 측정칸에 값을 넣는다', () => {
  const page = read('apps/frontend/src/app/(authenticated)/inspection/terminal-result/page.tsx');
  assert.match(page, /crimp-keypad-toggle/);
  assert.match(page, /keypadOpen=\{keypadOpen\}/);

  const panel = read('apps/frontend/src/app/(authenticated)/inspection/terminal-result/components/CrimpInspectPanel.tsx');
  assert.match(panel, /<NumericKeypad/);
  // 키패드를 쓰는 동안 OS 화상 키보드가 뜨지 않게 한다
  assert.match(panel, /inputMode=\{keypadOpen \? "none" : "decimal"\}/);

  const keypad = read('apps/frontend/src/components/shared/NumericKeypad.tsx');
  // 키를 눌러도 입력칸 포커스를 빼앗지 않는다
  assert.match(keypad, /onPointerDown=\{keepFocus\}/);
  assert.match(keypad, /animate-slide-in-right/);
});

test('server judges every BOM terminal side against TERMINAL_CRIMP_SPECS and stores ORDER_NO', () => {
  const service = read('apps/backend/src/modules/quality/crimp-inspect/services/crimp-inspect.service.ts');
  assert.match(service, /judgeCrimpSide/);
  assert.match(service, /FROM TERMINAL_CRIMP_SPECS/);
  assert.match(service, /s\.WIRE_ITEM_CODE === wire\.childItemCode/);
  assert.match(service, /orderNo: order\.orderNo/);
  assert.match(service, /CRIMP_INSPECT_TYPE = 'TERMINAL'/);

  const fgDto = read('apps/backend/src/modules/quality/continuity-inspect/dto/continuity-inspect.dto.ts');
  assert.doesNotMatch(fgDto, /@IsIn\(\[[^\]]*'TERMINAL'/);
});

test('4개 언어에 절압물검사 화면·외관 판정 코드 번역이 있다', () => {
  for (const lang of ['ko', 'en', 'zh', 'vi']) {
    const j = JSON.parse(read(`apps/frontend/src/locales/${lang}.json`));
    for (const key of ['title', 'description', 'selectOrder', 'inspector', 'visualChecks', 'save', 'pullForce']) {
      assert.equal(typeof j.inspection.terminalResult[key], 'string', `${lang} inspection.terminalResult.${key}`);
    }
    for (const status of ['NO_WIRE', 'MULTI_WIRE', 'NO_SPEC', 'DUP_SPEC']) {
      assert.equal(typeof j.inspection.terminalResult.sideStatus[status], 'string', `${lang} sideStatus.${status}`);
    }
    for (const code of ['SHAPE', 'MIXUP', 'MISSING', 'APPEARANCE']) {
      assert.equal(typeof j.comCode.CRIMP_VISUAL_CHECK[code], 'string', `${lang} comCode.CRIMP_VISUAL_CHECK.${code}`);
    }
    assert.equal(typeof j.comCodeGroup.CRIMP_VISUAL_CHECK, 'string', `${lang} comCodeGroup.CRIMP_VISUAL_CHECK`);
  }
});
