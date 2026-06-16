import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "useConLabelIssue.ts"), "utf8");

assert.match(source, /api\.post\("\/material\/label-print\/log",\s*\{/);
assert.match(source, /category:\s*"con_uid"/);
assert.match(source, /uidList:\s*conUids/);
assert.doesNotMatch(source, /matUids:\s*conUids/);

console.log("consumable label print log payload structure ok");
