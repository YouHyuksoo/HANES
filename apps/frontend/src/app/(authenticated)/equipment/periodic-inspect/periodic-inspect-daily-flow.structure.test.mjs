import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "page.tsx"), "utf8");
const entryPanel = readFileSync(
  join(__dirname, "../daily-inspect/components/InspectEntryPanel.tsx"),
  "utf8"
);

assert.match(source, /EquipListPanel/);
assert.match(source, /InspectEntryPanel/);
assert.match(source, /inspectType="PERIODIC"/);
assert.match(source, /apiBasePath="\/equipment\/periodic-inspect"/);
assert.match(source, /existingInspected=\{selectedTarget \? selectedTarget\.status !== "none" : false\}/);
assert.match(source, /\/master\/equip-inspect-items/);
assert.doesNotMatch(source, /DataGrid/);
assert.doesNotMatch(source, /Modal/);

assert.match(entryPanel, /inspectType = "DAILY"/);
assert.match(entryPanel, /params: \{ equipCode, inspectType, useYn: "Y", limit: 100 \}/);
assert.match(entryPanel, /existingInspected\s*\?\s*api/);
assert.match(entryPanel, /itemCode: item\.itemCode \?\? null/);
assert.match(entryPanel, /api\.post\(apiBasePath, payload\)/);
assert.match(entryPanel, /api\.put\(`\$\{apiBasePath\}\/\$\{equipCode\}\/\$\{inspectDate\}`/);
