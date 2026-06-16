import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

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
  assert.match(source, /r\.lslValue != null && r\.uslValue != null/);
  assert.match(source, /if \(r\.criteria\)/);
  assert.match(source, /\$\{r\.criteria\}\$\{r\.unit \? ` \(\$\{r\.unit\}\)` : ""\}/);
});
