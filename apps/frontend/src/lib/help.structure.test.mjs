import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "help.ts"), "utf8");

test("help.ts exposes HelpTab/HelpManifest types", () => {
  assert.match(source, /export type HelpTab = "user" \| "operator"/);
  assert.match(source, /export (?:type|interface) HelpManifest\b/);
});

test("helpDocPath builds /help/{tab}/{lang}/{menuCode}.md", () => {
  assert.match(source, /export function helpDocPath\(tab: HelpTab, menuCode: string, lang\?: string\): string/);
  assert.match(source, /`\/help\/\$\{tab\}\/\$\{l\}\/\$\{menuCode\}\.md`/);
});

test("filterManifest filters by title case-insensitively", () => {
  assert.match(source, /export function filterManifest\(/);
  assert.match(source, /toLowerCase\(\)/);
});

test("parseHelpDoc splits frontmatter and body", () => {
  assert.match(source, /export (?:type|interface) HelpMeta\b/);
  assert.match(source, /export function parseHelpDoc\(raw: string\)/);
});
