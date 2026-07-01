import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./kioskStore.ts", import.meta.url), "utf8");

test("kiosk store migrates old persisted scanner state when persist version changes", () => {
  assert.match(source, /version:\s*3/);
  assert.match(source, /migrate:\s*\(/);
  assert.match(source, /persistedState/);
  assert.match(source, /selectedEquip/);
});
