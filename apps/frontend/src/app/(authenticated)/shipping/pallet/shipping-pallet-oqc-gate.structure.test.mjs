import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("pallet page applies OQC_ENABLED before adding oqcStatus PASS to box queries", () => {
  assert.match(source, /useSysConfigStore/, "page should read the global system config store");
  assert.match(source, /state\.isEnabled\("OQC_ENABLED"\)/, "page should derive OQC_ENABLED from sys config");
  assert.match(source, /const oqcEnabled = !sysConfigLoaded \|\| sysConfigOqcEnabled/, "page should fail closed while config is not loaded yet");
  assert.match(source, /const buildAvailableBoxParams = useCallback/, "page should centralize available-box query params");
  assert.match(source, /if \(oqcEnabled\) params\.oqcStatus = "PASS"/, "page should add PASS filter only when OQC is enabled");
  assert.doesNotMatch(source, /params: \{ status: "CLOSED", unassigned: "true", oqcStatus: "PASS" \}/, "list fetch should not hardcode PASS");
  assert.doesNotMatch(source, /params: \{ boxNo, status: "CLOSED", oqcStatus: "PASS", unassigned: "true" \}/, "scan fetch should not hardcode PASS");
});
