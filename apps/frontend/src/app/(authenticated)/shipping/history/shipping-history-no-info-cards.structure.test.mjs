import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping history page does not render top info cards", () => {
  assert.doesNotMatch(source, /StatCard/, "history page should not import or render summary info cards");
  assert.doesNotMatch(source, /const stats = useMemo/, "card-only stats calculation should be removed");
  assert.doesNotMatch(source, /grid grid-cols-4 gap-3 flex-shrink-0/, "top summary-card row should be removed");
  assert.match(source, /<DataGrid data=\{data\} columns=\{columns\}/, "history grid should remain");
  assert.match(source, /toolbarLeft=\{/, "history filters should remain in the grid toolbar");
});
