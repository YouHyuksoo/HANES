import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");
const types = readFileSync(join(here, "types.ts"), "utf8");
const sources = readFileSync(join(here, "labelSources.ts"), "utf8");
const objectDesigner = readFileSync(join(here, "components/LabelObjectDesigner.tsx"), "utf8");

assert.match(types, /LabelCategory = "equip" \| "jig" \| "worker" \| "mat_lot" \| "box" \| "pallet"/);
assert.match(types, /LabelSourceTable = "equipment" \| "consumable" \| "worker" \| "mat_lot" \| "box" \| "pallet"/);
assert.match(types, /pallet:\s*"pallet"/);
assert.match(types, /if \(category === "pallet"\)[\s\S]*barcode:\s*"palletNo"[\s\S]*name:\s*"boxCount"[\s\S]*sub:\s*"totalQty"/);

assert.match(sources, /pallet:\s*\{\s*table:\s*"pallet"/);
assert.match(sources, /label:\s*"팔레트"/);
assert.match(sources, /key:\s*"palletNo",\s*label:\s*"팔레트번호"/);
assert.match(sources, /key:\s*"boxCount",\s*label:\s*"박스수"/);
assert.match(sources, /key:\s*"totalQty",\s*label:\s*"총수량"/);
assert.match(sources, /key:\s*"status",\s*label:\s*"상태"/);

assert.match(page, /pallet:\s*"pallet"/);
assert.match(objectDesigner, /pallet:\s*t\("master\.label\.srcPallet",\s*"팔레트"\)/);
