import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const panelSource = readFileSync(new URL("./components/ReceivablePanel.tsx", import.meta.url), "utf8");

test("/product/receive uses BarcodeScanInput for box scans", () => {
  assert.match(panelSource, /BarcodeScanInput/);
  assert.match(panelSource, /onScan=\{handleScan\}/);
  assert.match(panelSource, /maintainFocus/);
  assert.match(panelSource, /replace\(\s*\/\\r\?\\n\|\\r\/g/);
  assert.doesNotMatch(panelSource, /onKeyDown=\{\(e\) =>/);
  assert.doesNotMatch(panelSource, /leftIcon=\{<ScanLine/);
});
