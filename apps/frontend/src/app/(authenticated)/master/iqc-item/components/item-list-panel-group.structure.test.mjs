import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "ItemListPanel.tsx"), "utf8");

test("IQC left list groups parts under productType folders", () => {
  assert.match(source, /productType/);
  assert.match(source, /FolderOpen/);
  assert.match(source, /toggleGroup/);
  assert.match(source, /UNGROUPED/);
});
