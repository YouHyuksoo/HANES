import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

assert.match(source, /const inspectHistorySqlPreview = `[\s\S]*FROM EQUIP_INSPECT_LOGS log/);
assert.match(source, /LEFT JOIN EQUIP_MASTERS equip/);
assert.match(source, /sqlQuery=\{inspectHistorySqlPreview\}/);
assert.doesNotMatch(source, /FROM EQUIP_INSPECTIONS/);

console.log("inspect-history actual SQL preview structure ok");
