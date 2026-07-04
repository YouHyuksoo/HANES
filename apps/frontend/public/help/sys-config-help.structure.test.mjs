import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const userHelp = readFileSync(join(__dirname, "user", "ko", "SYS_CONFIG.md"), "utf8");
const operatorHelp = readFileSync(join(__dirname, "operator", "ko", "SYS_CONFIG.md"), "utf8");
const manifest = readFileSync(join(__dirname, "manifest.json"), "utf8");

test("SYS_CONFIG user help has valid frontmatter and practical sections", () => {
  assert.ok(userHelp.startsWith("---\n"));
  assert.match(userHelp, /menuCode: SYS_CONFIG/);
  assert.match(userHelp, /audience: user/);
  assert.match(userHelp, /# 환경설정/);
  assert.match(userHelp, /## 버튼별 기능/);
  assert.match(userHelp, /설정 추가/);
  assert.match(userHelp, /청킹 \+ 임베딩 재생성/);
  assert.match(userHelp, /AI 테이블 카탈로그/);
});

test("SYS_CONFIG operator help maps APIs and SYS_CONFIGS table", () => {
  assert.ok(operatorHelp.startsWith("---\n"));
  assert.match(operatorHelp, /menuCode: SYS_CONFIG/);
  assert.match(operatorHelp, /audience: operator/);
  assert.match(operatorHelp, /# 환경설정 — 운영 가이드/);
  assert.match(operatorHelp, /SYS_CONFIGS/);
  assert.match(operatorHelp, /PUT \/system\/configs\/bulk/);
  assert.match(operatorHelp, /POST \/ai\/knowledge\/reindex/);
  assert.match(operatorHelp, /GET \/ai\/catalog\/columns/);
});

test("manifest includes SYS_CONFIG route", () => {
  assert.match(manifest, /"menuCode": "SYS_CONFIG"/);
  assert.match(manifest, /"path": "\/system\/config"/);
});

test("SYS_CONFIG help avoids generic template placeholders", () => {
  assert.doesNotMatch(userHelp, /기간, 상태, 품목, 바코드, 담당자/);
  assert.doesNotMatch(operatorHelp, /기간, 상태, 품목, 바코드, 담당자/);
});
