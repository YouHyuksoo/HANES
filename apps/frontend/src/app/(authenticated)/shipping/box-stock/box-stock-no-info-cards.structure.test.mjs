import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("box stock page does not render information card frames", () => {
  assert.doesNotMatch(source, /<Card\b/);
  assert.doesNotMatch(source, /<\/Card>/);
  assert.doesNotMatch(source, /<CardContent\b/);
  assert.doesNotMatch(source, /<\/CardContent>/);
  assert.doesNotMatch(source, /\bStatCard\b|\binfoCards\b|\bstats\b/);
  assert.doesNotMatch(source, /import\s*\{[^}]*\bCard\b[^}]*\}\s*from\s*["']@\/components\/ui["']/);
  assert.doesNotMatch(source, /import\s*\{[^}]*\bCardContent\b[^}]*\}\s*from\s*["']@\/components\/ui["']/);
});

test("box stock page keeps master-detail grids after removing cards", () => {
  assert.match(source, /api\.get\("\/shipping\/box-stock"/);
  assert.match(source, /api\.get\(`\/shipping\/box-stock\/\$\{encodeURIComponent\(boxNo\)\}\/serials`/);
  assert.match(source, /<DataGrid[\s\S]*data=\{boxes\}/);
  assert.match(source, /<DataGrid[\s\S]*data=\{serials\}/);
});
