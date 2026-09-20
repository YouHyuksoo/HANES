import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(dir, "page.tsx");
// 상태 로직은 hooks/useInputKioskController.ts 로 옮겨졌다(2026-09-20, B 배치와 공유). 페이지+훅을 함께 검사한다.
const hookPath = path.join(dir, "hooks", "useInputKioskController.ts");
const readSource = () => fs.readFileSync(pagePath, "utf8") + fs.readFileSync(hookPath, "utf8");

test("kiosk blocks LAST submit when last items exist and plan qty would complete", () => {
  const source = readSource();

  assert.match(source, /hasLastItems/);
  assert.match(source, /\/production\/self-inspect\/items/);
  assert.match(source, /isLastBlock/);
  assert.match(source, /kiosk\.selfInspect\.lastBlock/);
  assert.match(source, /submitDisabledReasons/);
  assert.match(source, /if \(isLastBlock\) reasons\.push\(t\('kiosk\.selfInspect\.lastBlock'\)\)/);
});

test("kiosk treats MID and LAST as done only when the latest batch passed", () => {
  const source = readSource();

  assert.match(source, /latestInspectBatchPassed\(rows, 'MID'\)/);
  assert.match(source, /latestInspectBatchPassed\(rows, 'LAST'\)/);
});
