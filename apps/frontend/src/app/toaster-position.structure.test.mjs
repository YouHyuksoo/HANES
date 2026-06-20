import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./providers.tsx", import.meta.url), "utf8");

test("global toast events render from the bottom-left corner", () => {
  assert.match(source, /<Toaster[\s\S]*position="bottom-left"/, "Toaster position should be bottom-left");
  assert.doesNotMatch(source, /<Toaster[\s\S]*position="top-right"/, "Toaster must not stay at top-right");
});
