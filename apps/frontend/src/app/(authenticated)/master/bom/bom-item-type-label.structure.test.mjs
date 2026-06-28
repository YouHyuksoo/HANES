import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const bomTabSource = readFileSync(new URL("./components/BomTab.tsx", import.meta.url), "utf8");
const bomFormModalSource = readFileSync(new URL("./components/BomFormModal.tsx", import.meta.url), "utf8");
const bomUploadModalSource = readFileSync(new URL("./components/BomUploadModal.tsx", import.meta.url), "utf8");

test("BOM parent list renders ITEM_TYPE labels instead of raw itemType codes", () => {
  assert.match(pageSource, /itemTypeLabelMap/);
  assert.match(pageSource, /itemTypeLabelMap\[parent\.itemType\] \|\| parent\.itemType/);
  assert.doesNotMatch(pageSource, /\{parent\.itemCode\} \/ \{parent\.itemType\} \/ BOM/);
});

test("BOM tree and legend render translated ITEM_TYPE labels instead of raw codes", () => {
  assert.match(bomTabSource, /comCode\.ITEM_TYPE\.\$\{item\.itemType\}/);
  assert.match(bomTabSource, /comCode\.ITEM_TYPE\.\$\{key\}/);
  assert.doesNotMatch(bomTabSource, />\{item\.itemType\}<\/span>/);
  assert.doesNotMatch(bomTabSource, />\{key\}<\/span>/);
});

test("BOM child selection hint renders translated ITEM_TYPE label", () => {
  assert.match(bomFormModalSource, /comCode\.ITEM_TYPE\.\$\{selectedChild\.itemType\}/);
  assert.doesNotMatch(bomFormModalSource, /\(\{selectedChild\.itemType\}\)/);
});

test("BOM tree and edit form expose effective and completion dates", () => {
  assert.match(bomTabSource, /master\.bom\.validFrom/);
  assert.match(bomTabSource, /master\.bom\.validTo/);
  assert.match(bomTabSource, /item\.validFrom/);
  assert.match(bomTabSource, /item\.validTo/);
  assert.match(bomTabSource, /validFrom: selectedParent\.validFrom \?\? undefined/);
  assert.match(bomTabSource, /validTo: selectedParent\.validTo \?\? undefined/);
  assert.match(bomFormModalSource, /field="validFrom"[\s\S]*required/);
  assert.match(bomFormModalSource, /field="validTo"[\s\S]*required/);
  assert.match(bomFormModalSource, /disabled=\{saving \|\| !selectedChild \|\| !validFrom \|\| !validTo\}/);
});

test("BOM page supports date 기준 조회 and all-history lookup", () => {
  assert.match(pageSource, /bomDateMode/);
  assert.match(pageSource, /bomDateMode === "effective"/);
  assert.match(pageSource, /bomDateMode === "all"/);
  assert.match(pageSource, /params\.effectiveDate = effectiveDate/);
  assert.match(pageSource, /effectiveDate=\{bomDateMode === "effective" \? effectiveDate : undefined\}/);
});

test("BOM upload preview exposes effective and completion dates", () => {
  assert.match(bomUploadModalSource, /validFrom: string \| null/);
  assert.match(bomUploadModalSource, /validTo: string \| null/);
  assert.match(bomUploadModalSource, /master\.bom\.colValidFrom/);
  assert.match(bomUploadModalSource, /master\.bom\.colValidTo/);
  assert.match(bomUploadModalSource, /r\.validFrom/);
  assert.match(bomUploadModalSource, /r\.validTo/);
});
