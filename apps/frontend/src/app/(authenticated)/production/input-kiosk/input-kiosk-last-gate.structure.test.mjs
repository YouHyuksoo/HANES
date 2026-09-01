import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(dir, "page.tsx");

test("kiosk blocks LAST submit when last items exist and plan qty would complete", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /hasLastItems/);
  assert.match(source, /\/production\/self-inspect\/items/);
  assert.match(source, /isLastBlock/);
  assert.match(source, /kiosk\.selfInspect\.lastBlock/);
  assert.match(source, /submitDisabledReasons/);
  assert.match(source, /if \(isLastBlock\) reasons\.push\(t\('kiosk\.selfInspect\.lastBlock'\)\)/);
});

test("kiosk treats MID and LAST as done only when the latest batch passed", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /latestInspectBatchPassed\(rows, 'MID'\)/);
  assert.match(source, /latestInspectBatchPassed\(rows, 'LAST'\)/);
});
