import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync('packages/shared/src/utils/vendor-barcode-rules.ts', 'utf8');
const sharedIndex = fs.readFileSync('packages/shared/src/utils/index.ts', 'utf8');
const dto = fs.readFileSync('apps/backend/src/modules/master/dto/vendor-barcode-mapping.dto.ts', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/vendor-barcode/vendorBarcodeColumns.tsx', 'utf8');
const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/vendor-barcode/components/VendorBarcodeFormPanel.tsx', 'utf8');

test('바코드 매칭유형 값 집합을 @harness/shared 단일 출처로 노출한다', () => {
  assert.match(rules, /export const VENDOR_BARCODE_MATCH_TYPES = \['EXACT', 'PREFIX', 'REGEX'\] as const/);
  assert.match(rules, /export const VENDOR_BARCODE_DEFAULT_MATCH_TYPE/);
  assert.match(sharedIndex, /export \* from '\.\/vendor-barcode-rules'/);
});

test('백엔드 dto가 공유 매칭유형 값을 사용한다(로컬 리터럴 제거)', () => {
  assert.match(dto, /import \{ USE_YN_VALUES, VENDOR_BARCODE_MATCH_TYPES \} from '@harness\/shared'/);
  assert.match(dto, /const MATCH_TYPE_VALUES = VENDOR_BARCODE_MATCH_TYPES/);
  assert.doesNotMatch(dto, /\['EXACT', 'PREFIX', 'REGEX'\]/);
});

test('프론트 옵션이 공유 값에서 파생되고 panel은 중복 없이 재사용한다', () => {
  assert.match(columns, /import \{ VENDOR_BARCODE_MATCH_TYPES, type VendorBarcodeMatchType \} from "@harness\/shared"/);
  assert.match(columns, /export const MATCH_TYPE_OPTIONS = VENDOR_BARCODE_MATCH_TYPES\.map\(/);
  assert.match(panel, /import \{ MATCH_TYPE_OPTIONS \} from "\.\.\/vendorBarcodeColumns"/);
  // panel 로컬 중복 옵션 배열 제거
  assert.doesNotMatch(panel, /const MATCH_TYPE_OPTIONS = \[/);
});
