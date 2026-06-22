import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("ship order registration requires customer ship date before saving", () => {
  assert.match(source, /form\.shipDate\.trim\(\)\.length > 0/, "shipDate should be part of the save enable condition");
  assert.match(source, /label=\{t\("shipping\.shipOrder\.shipDate"\)\}[\s\S]*required/, "shipDate date input should be visibly required");
  assert.match(source, /shipDate:\s*form\.shipDate/, "payload should send the selected shipDate");
  assert.doesNotMatch(source, /shipDate:\s*form\.shipDate\s*\|\|\s*undefined/, "shipDate should not be treated as optional on create/update payload");
});
