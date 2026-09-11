import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const page = read('apps/frontend/src/app/(authenticated)/material/iqc-defect-receive/page.tsx');
const menuConfig = read('apps/frontend/src/config/menuConfig.ts');
const seed = JSON.parse(read('apps/backend/src/seeds/menu-config.json'));
const validator = read('apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts');
const manifest = JSON.parse(read('apps/frontend/public/help/manifest.json'));
const iqcService = read('apps/backend/src/modules/material/services/iqc-history.service.ts');
const receiveService = read('apps/backend/src/modules/material/services/iqc-defect-receive.service.ts');
const controller = read('apps/backend/src/modules/material/controllers/iqc-defect-receive.controller.ts');
const module_ = read('apps/backend/src/modules/material/receiving/receiving.module.ts');

test('MAT_IQC_DEFECT_RECEIVE is registered in all four menu places + help', () => {
  assert.match(menuConfig, /code: "MAT_IQC_DEFECT_RECEIVE", labelKey: "menu\.material\.iqcDefectReceive", path: "\/material\/iqc-defect-receive"/);
  assert.ok((seed.childMenuCodes?.MATERIAL ?? []).includes('MAT_IQC_DEFECT_RECEIVE'), 'seeds/menu-config.json childMenuCodes.MATERIAL');
  assert.match(validator, /'MAT_IQC_DEFECT_RECEIVE'/);
  const found = JSON.stringify(manifest).includes('"menuCode":"MAT_IQC_DEFECT_RECEIVE"');
  assert.ok(found, 'help manifest');
  assert.doesNotThrow(() => read('apps/frontend/public/help/user/ko/MAT_IQC_DEFECT_RECEIVE.md'));
  for (const lang of ['ko', 'en', 'zh', 'vi']) {
    const json = JSON.parse(read(`apps/frontend/src/locales/${lang}.json`));
    assert.equal(typeof json.menu['material.iqcDefectReceive'], 'string', `${lang} menu label`);
    assert.equal(typeof json.material.iqcDefectReceive?.receiveBtn, 'string', `${lang} page keys`);
    assert.equal(typeof json.material.iqc?.failReceiveHint, 'string', `${lang} FAIL hint`);
  }
});

test('IQC FAIL leaves stock in arrival stock by default (MANUAL) and only AUTO mode moves it', () => {
  assert.match(iqcService, /export const IQC_FAIL_DEFECT_MOVE_MODE_KEY = 'IQC_FAIL_DEFECT_MOVE_MODE';/);
  assert.match(iqcService, /if \(String\(mode\)\.toUpperCase\(\) !== 'AUTO'\) return;/);
  assert.match(iqcService, /async moveLotToDefectWarehouse\(/);
  // 판정 취소는 자동이동·수동입고 둘 다 원복
  assert.match(iqcService, /refType: In\(\['IQC_FAIL', IQC_DEFECT_RECEIVE_REF_TYPE\]\)/);
});

test('defect-receive backend: pending = FAIL·not concession·NORMAL·arrival qty>0, receive only into DEFECT warehouses, cancel guarded', () => {
  assert.match(receiveService, /lot\.iqcStatus = 'FAIL'/);
  assert.match(receiveService, /NVL\(lot\.specialAcceptYn, 'N'\) <> 'Y'/);
  assert.match(receiveService, /ast\.qty > 0/);
  assert.match(receiveService, /!== 'DEFECT' \|\| warehouse\.useYn !== 'Y'/);
  assert.match(receiveService, /refType: IQC_DEFECT_RECEIVE_REF_TYPE/);
  assert.match(receiveService, /이미 취소된 입고입니다/);
  assert.match(controller, /@Controller\('material\/iqc-defect-receive'\)/);
  assert.match(module_, /IqcDefectReceiveController/);
  assert.match(module_, /IqcDefectReceiveService/);
});

test('defect-receive page: scan via BarcodeScanInput, DEFECT warehouse select, confirm modal, history cancel', () => {
  assert.match(page, /<BarcodeScanInput[\s\S]*onScan=\{handleScan\}/);
  assert.match(page, /warehouseType="DEFECT"/);
  assert.match(page, /\/material\/iqc-defect-receive\/pending/);
  assert.match(page, /api\.post\("\/material\/iqc-defect-receive", \{/);
  assert.match(page, /\/material\/iqc-defect-receive\/cancel/);
  assert.match(page, /\/material\/iqc-defect-receive\/history/);
  assert.doesNotMatch(page, /window\.confirm|alert\(/);
});
