import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./useMasterOptions.ts", import.meta.url), "utf8");

test("worker options use WORKER_MASTERS workerCode as select value", () => {
  assert.match(source, /value:\s*w\.workerCode\s*\?\?\s*w\.id/);
});
