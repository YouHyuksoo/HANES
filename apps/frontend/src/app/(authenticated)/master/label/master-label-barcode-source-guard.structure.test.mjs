/**
 * 라벨 바코드/QR 소스필드 가드 — 2026-09-09 결함: 저장된 템플릿의 barcode-main 에 sourceField 가 없어
 * 모든 입하 라벨 QR 이 "SAMPLE" 로 인쇄됨(박스·팔레트·SFG·작업자 기본 템플릿도 동일).
 * 1) 로드 시 정규화(ensureObjectLabelDesign) 2) 실데이터 렌더에서 SAMPLE 금지 3) 디자이너 소스 변경 시 기본 식별자 보정
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const types = readFileSync(join(here, "types.ts"), "utf8");
const renderer = readFileSync(join(here, "components/LabelDesignRenderer.tsx"), "utf8");
const designer = readFileSync(join(here, "components/LabelObjectDesigner.tsx"), "utf8");

// 소스 테이블별 기본 식별자 매핑은 단일 출처
assert.match(types, /export const DEFAULT_BARCODE_FIELD_BY_SOURCE: Record<LabelSourceTable, string> = \{/);
for (const pair of ['mat_lot: "matUid"', 'box: "boxNo"', 'pallet: "palletNo"', 'sg_label: "sgBarcode"', 'fg_label: "fgBarcode"', 'worker: "workerCode"', 'consumable: "conUid"', 'equipment: "equipCode"']) {
  assert.ok(types.includes(pair), `DEFAULT_BARCODE_FIELD_BY_SOURCE must contain ${pair}`);
}

// 로드 정규화: 템플릿 elements 가 있어도 바코드 sourceField 를 보정한다
assert.match(types, /export function normalizeLabelElements\(/);
assert.match(types, /elements: normalizeLabelElements\(design\.elements, sourceTable\)/);
assert.match(types, /element\.type !== "barcode" \|\| \(element\.sourceField && element\.sourceField\.trim\(\)\)/);

// 실데이터 렌더에서 빈 값이면 SAMPLE 대신 NO DATA 표시
assert.match(renderer, /if \(!value && data\) \{/);
assert.match(renderer, /data-label-barcode-empty="true"/);

// 디자이너: 소스 테이블 변경 시 바코드는 기본 식별자로 채운다(undefined 금지)
assert.match(designer, /const fallback = element\.type === "barcode" \? DEFAULT_BARCODE_FIELD_BY_SOURCE\[next\] : undefined;/);
assert.doesNotMatch(designer, /sourceField: element\.sourceField && nextFields\.some\(\(field\) => field\.key === element\.sourceField\)\s*\?\s*element\.sourceField\s*:\s*undefined/);
