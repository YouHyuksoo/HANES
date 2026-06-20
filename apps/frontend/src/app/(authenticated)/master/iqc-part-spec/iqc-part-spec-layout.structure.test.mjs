import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "page.tsx"), "utf8");

test("/master/iqc-part-spec keeps a narrower left panel", () => {
  assert.match(source, /className="col-span-3 min-h-0"/);
  assert.match(source, /className="col-span-9 min-h-0[^"]*"/);
  assert.doesNotMatch(source, /className="col-span-4 min-h-0"/);
  assert.doesNotMatch(source, /className="col-span-8 min-h-0"/);
});
