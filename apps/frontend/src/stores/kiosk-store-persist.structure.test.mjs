import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./kioskStore.ts", import.meta.url), "utf8");

test("kiosk persist keeps the selected job order across browser refresh", () => {
  const partializeMatch = source.match(/partialize:\s*\(state\)\s*=>\s*\(\{([\s\S]*?)\}\)/);
  assert.ok(partializeMatch, "persist partialize block should exist");

  const partializeBody = partializeMatch[1];
  assert.match(partializeBody, /selectedEquip:\s*state\.selectedEquip/);
  assert.match(partializeBody, /selectedJobOrder:\s*state\.selectedJobOrder/);
  assert.doesNotMatch(source, /selectedJobOrder는 저장하지 않아/);
});
