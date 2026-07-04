import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(__dirname, "HelpPanel.tsx"), "utf8");

test("HelpPanel uses store, pathname mapping, and renders markdown", () => {
  assert.match(panel, /useHelpStore/);
  assert.match(panel, /findMenuCodeByPath/);
  assert.match(panel, /useHelpDoc/);
  assert.match(panel, /MarkdownRenderer/);
});

test("HelpPanel has user/operator tabs and full-help link", () => {
  assert.match(panel, /setTab\("user"\)/);
  assert.match(panel, /setTab\("operator"\)/);
  assert.match(panel, /\/help/);
});

test("HelpPanel shows fallback when notFound", () => {
  assert.match(panel, /notFound/);
});

test("HelpPanel opens with double-width default panel", () => {
  assert.match(panel, /useState\(896\)/);
});

test("HelpPanel provides in-panel document search controls", () => {
  assert.match(panel, /searchQuery/);
  assert.match(panel, /help\.searchInCurrentDoc/);
  assert.match(panel, /data-help-search-match/);
  assert.match(panel, /scrollIntoView/);
});
