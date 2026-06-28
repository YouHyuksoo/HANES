import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
// 점검항목 컬럼 셀 로직은 equipInspectItemColumns.tsx 팩토리로 분리되었다
const columnsSource = readFileSync(new URL("./equipInspectItemColumns.tsx", import.meta.url), "utf8");

test("equip inspect item editor uses a right-side panel instead of Modal", () => {
  assert.doesNotMatch(source, /,\s*Modal\s*,/);
  assert.doesNotMatch(source, /<Modal\b/);
  assert.match(source, /panelOpen/);
  assert.match(source, /animate-slide-in-right/);
  assert.match(source, /border-l border-border bg-background/);
});

test("equip inspect item editor supports image preview upload and removal", () => {
  assert.match(source, /imageUrl/);
  assert.match(source, /selectedImageFile/);
  assert.match(source, /\/master\/equip-inspect-item-masters\/\$\{encodeURIComponent\(itemCode\)\}\/image/);
  assert.match(source, /accept="image\/jpeg,image\/png,image\/gif,image\/webp"/);
  assert.match(source, /ImageIcon/);
  assert.match(source, /Trash2/);
});

test("measure criteria falls back to criteria text when numeric limits are not fixed", () => {
  assert.match(columnsSource, /r\.lslValue != null && r\.uslValue != null/);
  assert.match(columnsSource, /if \(r\.criteria\)/);
  assert.match(columnsSource, /\$\{r\.criteria\}\$\{r\.unit \? ` \(\$\{r\.unit\}\)` : ""\}/);
});

test("measure unit is selected from UNIT_TYPE common code dropdown", () => {
  assert.match(source, /<ComCodeSelect\s+groupCode="UNIT_TYPE"[\s\S]*showCode[\s\S]*value=\{form\.unit\}/);
  assert.doesNotMatch(source, /<Input\s+label=\{t\("master\.equipInspect\.unit"/);
});
