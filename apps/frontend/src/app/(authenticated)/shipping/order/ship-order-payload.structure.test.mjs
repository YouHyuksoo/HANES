import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

assert.match(source, /import PartSearchModal from "@\/components\/shared\/PartSearchModal"/);
assert.match(source, /const \[orderItems, setOrderItems\] = useState<ShipOrderLine\[\]>\(\[\]\)/);
assert.match(source, /items: orderItems\.map\(\(item\) => \(\{/);
assert.match(source, /await api\.post\("\/shipping\/orders", payload\)/);
assert.doesNotMatch(source, /await api\.post\("\/shipping\/orders", form\)/);
assert.match(source, /disabled=\{!canSave \|\| saving\}/);
assert.match(source, /orderItems\.length > 0/);
