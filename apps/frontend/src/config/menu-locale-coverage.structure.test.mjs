import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const menuConfigPath = resolve(repoRoot, "apps/frontend/src/config/menuConfig.ts");
const localeDir = resolve(repoRoot, "apps/frontend/src/locales");
const locales = ["ko", "en", "zh", "vi"];

function getTranslationValue(source, key) {
  const segments = key.split(".");

  function resolveAt(value, index) {
    if (!value || typeof value !== "object") return undefined;

    const remainingKey = segments.slice(index).join(".");
    if (Object.prototype.hasOwnProperty.call(value, remainingKey)) {
      return value[remainingKey];
    }

    const segment = segments[index];
    if (!Object.prototype.hasOwnProperty.call(value, segment)) {
      return undefined;
    }

    if (index === segments.length - 1) {
      return value[segment];
    }

    return resolveAt(value[segment], index + 1);
  }

  return resolveAt(source, 0);
}

test("menuConfig labelKeys are translated in every locale", () => {
  const menuConfigSource = readFileSync(menuConfigPath, "utf8");
  const labelKeys = [
    ...new Set(
      Array.from(menuConfigSource.matchAll(/labelKey:\s*["']([^"']+)["']/g)).map(
        (match) => match[1],
      ),
    ),
  ].sort();

  assert.ok(labelKeys.length > 0, "menuConfig labelKeys should be detected");

  const missing = [];

  for (const locale of locales) {
    const messages = JSON.parse(
      readFileSync(resolve(localeDir, `${locale}.json`), "utf8"),
    );

    for (const labelKey of labelKeys) {
      const value = getTranslationValue(messages, labelKey);
      if (typeof value !== "string" || value.trim() === "") {
        missing.push(`${locale}: ${labelKey}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});
