import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../../../../../");
const locales = ["ko", "en", "zh", "vi"];
const audiences = ["user", "operator"];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function getValue(obj, key) {
  const segments = key.split(".");
  let current = obj;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}

function parseHelpDoc(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw };
  const [, fm] = match;
  const meta = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = /^([A-Za-z][\w]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = rawVal.trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      meta[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      meta[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return { meta, body: match[2] ?? "" };
}

test("CONS_MOUNT help docs exist for all languages and audiences", () => {
  for (const audience of audiences) {
    for (const lang of locales) {
      const path = resolve(
        repoRoot,
        `apps/frontend/public/help/${audience}/${lang}/CONS_MOUNT.md`,
      );
      const content = readFileSync(path, "utf8");
      assert.ok(content.length > 0, `${audience}/${lang} doc should not be empty`);
      assert.ok(content.startsWith("---"), `${audience}/${lang} doc should start with frontmatter ---`);
      const { meta } = parseHelpDoc(content);
      assert.equal(meta.menuCode, "CONS_MOUNT", `${audience}/${lang} menuCode should be CONS_MOUNT`);
      assert.equal(meta.audience, audience, `${audience}/${lang} audience should match folder`);
      assert.ok(meta.title && meta.title.length > 0, `${audience}/${lang} title should be set`);
    }
  }
});

test("CONS_MOUNT is registered in help manifest.json", () => {
  const manifest = readJson(resolve(repoRoot, "apps/frontend/public/help/manifest.json"));
  const found = manifest.categories
    .flatMap((cat) => cat.items)
    .find((item) => item.menuCode === "CONS_MOUNT");
  assert.ok(found, "CONS_MOUNT should be in manifest.json");
  assert.equal(found.path, "/consumables/mount", "path should be /consumables/mount");
  assert.ok(found.title, "manifest title should be set");
});

test("consumables.mount locale keys are present in every locale", () => {
  const requiredKeys = [
    "consumables.mount.title",
    "consumables.mount.operStatus",
    "consumables.mount.statusWarehouse",
    "consumables.mount.statusMounted",
    "consumables.mount.statusRepair",
    "consumables.mount.mountedEquip",
    "consumables.mount.lifeStatus",
    "consumables.mount.searchPlaceholder",
    "consumables.mount.mountAction",
    "consumables.mount.unmountAction",
    "consumables.mount.repairAction",
    "consumables.mount.completeRepairAction",
    "consumables.mount.historyAction",
    "consumables.mount.mountTitle",
    "consumables.mount.unmountTitle",
    "consumables.mount.repairTitle",
    "consumables.mount.completeRepairTitle",
    "consumables.mount.targetEquip",
    "consumables.mount.remarkPlaceholder",
    "consumables.mount.historyTitle",
    "consumables.mount.logDate",
    "consumables.mount.logAction",
    "consumables.mount.worker",
    "consumables.mount.actionMount",
    "consumables.mount.actionUnmount",
  ];
  const missing = [];
  for (const lang of locales) {
    const messages = readJson(resolve(repoRoot, `apps/frontend/src/locales/${lang}.json`));
    for (const key of requiredKeys) {
      const value = getValue(messages, key);
      if (typeof value !== "string" || value.trim() === "") {
        missing.push(`${lang}: ${key}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("consumables mount page uses translated keys", () => {
  const pagePath = resolve(repoRoot, "apps/frontend/src/app/(authenticated)/consumables/mount/page.tsx");
  const source = readFileSync(pagePath, "utf8");
  assert.match(source, /t\("consumables\.mount\.title"\)/, "page title should use translation key");
  assert.match(source, /t\("consumables\.mount\.operStatus"\)/, "operStatus should use translation key");
  assert.match(source, /t\("consumables\.mount\.mountedEquip"\)/, "mountedEquip should use translation key");
  assert.match(source, /t\("consumables\.mount\.lifeStatus"\)/, "lifeStatus should use translation key");
  assert.match(source, /t\("consumables\.mount\.searchPlaceholder"\)/, "searchPlaceholder should use translation key");
});
