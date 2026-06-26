import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "IqcSpecPanel.tsx"), "utf8");

test("IQC item AQL selects use registered AQL_STANDARDS combinations, not raw common-code cartesian choices", () => {
  assert.match(source, /api\.get\("\/quality\/aql"/, "panel should load active AQL standards");
  assert.match(source, /validAqlStandards/, "panel should keep the valid standards list");
  assert.match(source, /availableAqlOptionsForLevel/, "AQL value options should be derived from selected inspection level");
  assert.match(source, /aqlStandardOptionsByLevel/, "valid AQL values should be grouped by inspection level");
  assert.doesNotMatch(source, /aqlOptions\.map\(\(o\) => \(\s*<option[\s\S]*value=\{o\.value\}/, "AQL select must not expose all AQL_VALUE common codes directly");
  assert.match(source, /AQL 기준관리에서 먼저 등록하세요/, "empty valid-combination state should guide users to register the standard first");
});
