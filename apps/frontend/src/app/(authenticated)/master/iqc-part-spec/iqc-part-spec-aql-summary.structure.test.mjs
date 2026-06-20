import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

test("/master/iqc-part-spec shows selected part AQL 기준 and LOT preview", () => {
  assert.match(source, /interface PartItem[\s\S]*sampleQty\?: number \| null/);
  assert.match(source, /interface PartItem[\s\S]*inspectionLevel\?: string \| null/);
  assert.match(source, /interface PartItem[\s\S]*aqlCritical\?: number \| null/);
  assert.match(source, /interface PartItem[\s\S]*aqlMajor\?: number \| null/);
  assert.match(source, /interface PartItem[\s\S]*aqlMinor\?: number \| null/);

  assert.match(source, /selectedPart/);
  assert.match(source, /AQL 기준/);
  assert.match(source, /Critical AQL/);
  assert.match(source, /Major AQL/);
  assert.match(source, /Minor AQL/);
  assert.match(source, /LOT 수량 미리보기/);
  assert.match(source, /\/quality\/aql\/resolve-iqc/);
  assert.match(source, /aqlPreview\?\.sampleQty/);
  assert.match(source, /aqlPreview\?\.majorRule/);
  assert.match(source, /aqlPreview\?\.minorRule/);
});
