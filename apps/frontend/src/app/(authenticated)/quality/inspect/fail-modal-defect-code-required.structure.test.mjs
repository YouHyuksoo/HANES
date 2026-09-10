import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const A = "apps/frontend/src/app/(authenticated)";
const read = (rel) => fs.readFileSync(path.resolve(`${A}/${rel}`), "utf8");

test("quality/inspect FailModal requires a VISUAL_DEFECT code before a FAIL judgement can be saved", () => {
  const source = read("quality/inspect/components/FailModal.tsx");
  assert.match(source, /groupCode="VISUAL_DEFECT"/);
  assert.match(source, /const canSubmit = errorCode\.trim\(\)\.length > 0;/);
  assert.match(source, /if \(!canSubmit\) return;/);
  assert.match(source, /disabled=\{submitting \|\| !canSubmit\}/);
  assert.match(source, /disabledReason=\{t\("quality\.inspect\.defectCodeRequired"\)\}/);
});

test("inspection/result FailModal requires a CONTINUITY_DEFECT code before a FAIL judgement can be saved", () => {
  const source = read("inspection/result/components/FailModal.tsx");
  assert.match(source, /groupCode="CONTINUITY_DEFECT"/);
  assert.match(source, /const canSubmit = errorCode\.trim\(\)\.length > 0;/);
  assert.match(source, /if \(!canSubmit\) return;/);
  assert.match(source, /disabled=\{submitting \|\| !canSubmit\}/);
  assert.match(source, /disabledReason=\{t\("quality\.inspect\.defectCodeRequired"\)\}/);
});

test("inspection/integrated blocks submit while any FAIL step has no defect code", () => {
  const source = read("inspection/integrated/components/IntegratedInspectPanel.tsx");
  assert.match(source, /failStepsMissingReason = steps\.filter\(\(s\) => s\.passYn === "N" && !s\.errorCode\.trim\(\)\)/);
  assert.match(source, /failStepsMissingReason\.length === 0/);
  assert.match(source, /t\("quality\.inspect\.defectCodeRequired"\)/);
});

test("inspection/structure blocks save when FAIL has no checked defect item", () => {
  const source = read("inspection/structure/components/StructureInspectPanel.tsx");
  assert.match(source, /failReasonMissing = passYn === "N" && checkedCount === 0/);
  assert.match(source, /if \(!fgLabel \|\| failReasonMissing\) return;/);
  assert.match(source, /disabled=\{saving \|\| failReasonMissing\}/);
  assert.match(source, /t\("inspection\.structure\.defectItemRequired"\)/);
});

test("required-reason i18n keys exist in all 4 locales", () => {
  for (const lang of ["ko", "en", "zh", "vi"]) {
    const json = JSON.parse(fs.readFileSync(path.resolve(`apps/frontend/src/locales/${lang}.json`), "utf8"));
    assert.equal(typeof json.quality?.inspect?.defectCodeRequired, "string", `${lang} quality.inspect.defectCodeRequired`);
    assert.equal(typeof json.inspection?.structure?.defectItemRequired, "string", `${lang} inspection.structure.defectItemRequired`);
  }
});
