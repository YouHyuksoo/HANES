import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("ship order grid status column exposes detailed help with a question icon", () => {
  assert.match(source, /HelpCircle/, "status header should use a question help icon");
  assert.match(source, /const shipOrderStatusHelpText/, "page should define detailed status help text");
  for (const status of ["DRAFT", "CONFIRMED", "SHIPPING", "SHIPPED", "CLOSED"]) {
    assert.match(source, new RegExp(`${status}:\\s*[^\\\\n]`), `${status} should be explained in the help text`);
  }
  assert.match(source, /function ShipOrderStatusHeader/, "status header should be a dedicated component");
  assert.match(source, /title=\{shipOrderStatusHelpText\}/, "question icon should show the detailed explanation on hover");
  assert.match(source, /aria-label=\{shipOrderStatusHelpText\}/, "question icon should expose explanation for accessibility");
  assert.match(source, /header:\s*\(\)\s*=>\s*<ShipOrderStatusHeader/, "status column should render the custom help header");
});
