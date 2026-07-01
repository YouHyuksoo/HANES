import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const panelPath = path.resolve("apps/frontend/src/app/(authenticated)/quality/inspect/components/VisualInspectPanel.tsx");

test("VisualInspectPanel uses common BarcodeScanInput for FG barcode scans", () => {
  const source = fs.readFileSync(panelPath, "utf8");

  assert.match(source, /BarcodeScanInput/);
  assert.doesNotMatch(source, /onKeyDown=\{handleScanKeyDown\}/);
  assert.doesNotMatch(source, /if \(e\.key === ["']Enter["']\)/);
  assert.match(source, /onScan=\{lookupLabel\}/);
  assert.match(source, /maintainFocus/);
});

