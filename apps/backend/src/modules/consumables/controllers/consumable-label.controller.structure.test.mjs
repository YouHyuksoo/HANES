import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./consumable-label.controller.ts", import.meta.url), "utf8");

test("consumable label controller returns standard API responses without double data wrapping", () => {
  assert.match(source, /ResponseUtil/);
  assert.match(source, /return ResponseUtil\.success\(data/);
  assert.doesNotMatch(source, /return\s+\{\s*data\s*\}/);
});
