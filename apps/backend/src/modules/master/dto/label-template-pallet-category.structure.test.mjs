import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const dto = readFileSync(new URL('./label-template.dto.ts', import.meta.url), 'utf8');
const frontendTypes = readFileSync(new URL('../../../../../frontend/src/app/(authenticated)/master/label/types.ts', import.meta.url), 'utf8');

assert.match(frontendTypes, /"pallet"/, 'frontend label source includes pallet');
assert.match(dto, /LABEL_TEMPLATE_CATEGORIES[\s\S]*'pallet'/, 'backend label template categories must include pallet');
assert.match(dto, /@IsIn\(LABEL_TEMPLATE_CATEGORIES\)[\s\S]*category:\s*string/, 'create DTO must validate category against shared category list');
assert.match(dto, /@IsIn\(LABEL_TEMPLATE_CATEGORIES\)[\s\S]*category\?:\s*string/, 'query DTO must validate category against shared category list');
