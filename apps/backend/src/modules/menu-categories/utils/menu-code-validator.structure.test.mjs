import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../../../../..");
const menuConfigPath = resolve(repoRoot, "apps/frontend/src/config/menuConfig.ts");
const validatorPath = resolve(repoRoot, "apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts");

function extractFrontendLeafCodes(source) {
  const codes = new Set();
  for (const line of source.split(/\r?\n/)) {
    const codeMatch = line.match(/code:\s*"([A-Z0-9_]+)"/);
    if (codeMatch && /path:\s*"[^"]+"/.test(line)) {
      codes.add(codeMatch[1]);
    }
  }
  return [...codes].sort();
}

function extractValidatorCodes(source) {
  const codes = new Set();
  const codePattern = /'([A-Z0-9_]+)'/g;
  for (const match of source.matchAll(codePattern)) {
    codes.add(match[1]);
  }
  return [...codes].sort();
}

test("menu-code-validator includes every path-backed frontend leaf menu code", () => {
  const frontendLeafCodes = extractFrontendLeafCodes(readFileSync(menuConfigPath, "utf8"));
  const validatorCodes = new Set(extractValidatorCodes(readFileSync(validatorPath, "utf8")));

  const missing = frontendLeafCodes.filter((code) => !validatorCodes.has(code));
  assert.deepEqual(missing, []);
});
