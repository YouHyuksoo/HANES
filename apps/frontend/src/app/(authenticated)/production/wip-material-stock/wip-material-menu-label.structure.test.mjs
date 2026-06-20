import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const koLocalePath = path.join(repoRoot, 'apps/frontend/src/locales/ko.json');
const menuConfigPath = path.join(repoRoot, 'apps/frontend/src/config/menuConfig.ts');

test('원자재 공정재고/수불 메뉴와 화면 제목은 새 한국어 용어를 사용한다', () => {
  const ko = JSON.parse(fs.readFileSync(koLocalePath, 'utf8'));

  assert.equal(ko.menu['production.wipMaterialStock'], '원자재공정재고');
  assert.equal(ko.menu['production.wipMaterialTrans'], '원자재공정수불');
  assert.equal(ko.production.wipMaterialStock.title, '원자재공정재고');
  assert.equal(ko.production.wipMaterialTrans.title, '원자재공정수불');
  assert.match(ko.production.wipMaterialStock.description, /원자재공정재고/);
  assert.match(ko.production.wipMaterialTrans.description, /원자재공정재고/);
});

test('원자재 공정재고/수불 메뉴는 기존 라우트와 번역 키를 유지한다', () => {
  const menuConfig = fs.readFileSync(menuConfigPath, 'utf8');

  assert.match(menuConfig, /labelKey:\s*"menu\.production\.wipMaterialStock"[\s\S]*path:\s*"\/production\/wip-material-stock"/);
  assert.match(menuConfig, /labelKey:\s*"menu\.production\.wipMaterialTrans"[\s\S]*path:\s*"\/production\/wip-material-trans"/);
});
