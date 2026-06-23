import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actionBar = readFileSync(
  "apps/frontend/src/app/(authenticated)/material/receive-label/components/PrintActionBar.tsx",
  "utf8",
);
const zebraHook = readFileSync("apps/frontend/src/hooks/useZebraPrinter.ts", "utf8");

assert.match(
  zebraHook,
  /export function useZebraPrinter\(enabled = true\)/,
  "useZebraPrinter must support disabled mode so pages do not eagerly call optional local printer agents.",
);
assert.match(
  zebraHook,
  /if \(!enabled\) \{\s*setIsAgentAvailable\(false\);\s*setPrinters\(\[\]\);\s*return;/s,
  "checkStatus must short-circuit before localhost:9100 fetches when disabled.",
);
assert.match(
  actionBar,
  /const isZplUsbMode = printMethod === 'ZPL_USB';/,
  "PrintActionBar must derive an explicit ZPL USB mode flag.",
);
assert.match(
  actionBar,
  /useZebraPrinter\(isZplUsbMode\)/,
  "Receive label page must only check Zebra Browser Print after ZPL USB is selected.",
);
assert.doesNotMatch(
  actionBar,
  /useZebraPrinter\(\)/,
  "Receive label page must not eagerly initialize Zebra Browser Print on page load.",
);
