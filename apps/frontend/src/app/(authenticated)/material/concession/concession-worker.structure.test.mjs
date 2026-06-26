import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("concession modal uses worker master selector next to QR scan", () => {
  assert.match(source, /WorkerSelect/);
  assert.match(source, /specialAcceptWorkerCode/);
  assert.match(source, /작업자 QR 스캔/);
  assert.match(source, /작업자 선택/);
  assert.match(source, /grid grid-cols-1 md:grid-cols-\[minmax\(0,1fr\)_minmax\(13rem,16rem\)_auto\][\s\S]*workerQrText[\s\S]*<WorkerSelect[\s\S]*handleWorkerQrLookup/s);
});

test("concession apply payload includes selected worker code", () => {
  assert.match(source, /specialAcceptWorkerCode:\s*specialAcceptWorkerCode/);
  assert.match(source, /actionType === "apply"/);
});

test("concession modal supports worker QR scan lookup", () => {
  assert.match(source, /workerQrText/);
  assert.match(source, /handleWorkerQrLookup/);
  assert.match(source, /\/master\/workers\/by-qr\/\$\{encodeURIComponent\(workerQrText\.trim\(\)\)\}/);
  assert.match(source, /onKeyDown=\{\(e\) => \{\s*if \(e\.key === "Enter"\)/s);
});
