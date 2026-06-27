import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dto = readFileSync(new URL('./label-template.dto.ts', import.meta.url), 'utf8');
const frontendTypes = readFileSync(new URL('../../../../../frontend/src/app/(authenticated)/master/label/types.ts', import.meta.url), 'utf8');

assert.match(frontendTypes, /"pallet"/, 'frontend label source includes pallet');
assert.match(dto, /LABEL_TEMPLATE_CATEGORIES[\s\S]*'pallet'/, 'backend label template categories must include pallet');

// 프론트 정본 LabelCategory(equip/jig/worker/mat_lot/box/pallet/sg/fg)의 모든 값은
// 백엔드 LABEL_TEMPLATE_CATEGORIES에 존재해야 한다 (FgLabelPrintHost가 category=fg 요청).
const frontendCategories = (frontendTypes.match(/export type LabelCategory =([^;]+);/)?.[1] ?? '')
  .match(/"([a-z_]+)"/g)
  ?.map((s) => s.replace(/"/g, '')) ?? [];
assert.ok(frontendCategories.length >= 8, 'frontend LabelCategory union must be parsed');
const backendCategories = (dto.match(/LABEL_TEMPLATE_CATEGORIES\s*=\s*\[([^\]]+)\]/)?.[1] ?? '')
  .match(/'([a-z_]+)'/g)
  ?.map((s) => s.replace(/'/g, '')) ?? [];
for (const cat of frontendCategories) {
  assert.ok(
    backendCategories.includes(cat),
    `backend LABEL_TEMPLATE_CATEGORIES must include frontend category '${cat}'`,
  );
}
assert.match(dto, /@IsIn\(LABEL_TEMPLATE_CATEGORIES\)[\s\S]*category:\s*string/, 'create DTO must validate category against shared category list');
assert.match(dto, /@IsIn\(LABEL_TEMPLATE_CATEGORIES\)[\s\S]*category\?:\s*string/, 'query DTO must validate category against shared category list');
