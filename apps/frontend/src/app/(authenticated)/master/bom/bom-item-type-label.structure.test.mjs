import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const bomTabSource = readFileSync(new URL("./components/BomTab.tsx", import.meta.url), "utf8");
const bomFormModalSource = readFileSync(new URL("./components/BomFormModal.tsx", import.meta.url), "utf8");

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
