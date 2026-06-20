import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping confirm page does not render top status info cards", () => {
  assert.equal(
    /<StatCard\b/.test(source),
    false,
    "top status summary StatCard components should not be rendered on the operational shipping confirm screen",
  );
  assert.equal(
    /grid-cols-4[^>]*>\s*\{?\s*<StatCard/s.test(source),
    false,
    "the four-column top summary card grid should be removed",
  );
});
