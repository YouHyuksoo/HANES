import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("pallet grid status column exposes detailed transition help with a question icon", () => {
  assert.match(source, /HelpCircle/, "status header should use a question help icon");
  assert.match(source, /const palletStatusHelpText/, "page should define detailed pallet status transition help");
  for (const status of ["OPEN", "CLOSED", "LOADED", "SHIPPED"]) {
    assert.match(source, new RegExp(`${status}:\\s*[^\\n]`), `${status} should be explained in the help text`);
  }
  assert.match(source, /OPEN -> CLOSED -> LOADED -> SHIPPED/, "help text should show the main state transition");
  assert.match(source, /CLOSED -> OPEN/, "help text should explain reopen transition");
  assert.match(source, /header:\s*\(\)\s*=>\s*<PalletStatusHeader/, "status column should render the custom help header");
});
