import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "page.tsx"), "utf8");
const aqlController = readFileSync(
  join(__dirname, "../../../../../../backend/src/modules/quality/aql/controllers/aql.controller.ts"),
  "utf8",
);

test("/master/iqc-part-spec shows selected part AQL 기준 and LOT preview", () => {
  assert.match(source, /interface PartItem[\s\S]*sampleQty\?: number \| null/);
  assert.match(source, /interface PartItem[\s\S]*iqcAqlPolicyCode\?: string \| null/);
  assert.doesNotMatch(source, /interface PartItem[\s\S]*aqlCritical\?: number \| null/);
  assert.doesNotMatch(source, /interface PartItem[\s\S]*aqlMajor\?: number \| null/);
  assert.doesNotMatch(source, /interface PartItem[\s\S]*aqlMinor\?: number \| null/);

  assert.match(source, /selectedPart/);
  assert.match(source, /AQL 기준/);
  assert.match(source, /AQL 정책/);
  assert.doesNotMatch(source, /Critical AQL/);
  assert.doesNotMatch(source, /selectedPart\.aqlCritical/);
  assert.doesNotMatch(source, /selectedPart\.aqlMajor/);
  assert.doesNotMatch(source, /selectedPart\.aqlMinor/);
  assert.match(source, /LOT 수량 미리보기/);
  assert.match(source, /\/quality\/aql\/resolve-iqc/);
  assert.match(source, /aqlPreview\?\.inspectionLevel/);
  assert.match(source, /aqlPreview\?\.sampleQty/);
  assert.match(source, /aqlPreview\?\.majorRule/);
  assert.match(source, /aqlPreview\?\.minorRule/);
});

test("/master/iqc-part-spec AQL preview follows item-spec AQL judgment path", () => {
  assert.match(aqlController, /@Get\('resolve-iqc-items'\)/);
  assert.match(aqlController, /resolveIqcPolicyByItem/);

  assert.match(source, /\/quality\/aql\/resolve-iqc-items/);
  assert.doesNotMatch(source, /\/quality\/aql\/resolve-iqc",/);
  assert.match(source, /itemResults\?: Array<\{/);
  assert.match(source, /검사항목 기준/);
  assert.match(source, /파괴\/고정/);
  assert.match(source, /itemSpecSummary/);
});
