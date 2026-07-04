#!/usr/bin/env node
/**
 * @file tools/help-frontmatter-audit.mjs
 * @description 도움말 md frontmatter 필수 필드(menuCode/summary/keywords) 누락 점검.
 * 사용: node tools/help-frontmatter-audit.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['apps/frontend/public/help/user/ko', 'apps/frontend/public/help/operator/ko'];

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMd(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

function parseFrontMatter(raw) {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z][\w]*)\s*:\s*(.*)$/.exec(line.trim());
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

const results = [];
for (const root of ROOTS) {
  for (const file of listMd(root)) {
    const raw = fs.readFileSync(file, 'utf8');
    const meta = parseFrontMatter(raw);
    const missing = [];
    if (!meta) missing.push('frontmatter 없음');
    else {
      if (!meta.menuCode) missing.push('menuCode');
      if (!meta.summary) missing.push('summary');
      if (!meta.keywords) missing.push('keywords');
    }
    if (raw.charCodeAt(0) === 0xfeff) missing.push('UTF-8 BOM 존재');
    if (missing.length > 0) results.push({ file: file.replace(/\\/g, '/'), missing });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  if (results.length === 0) console.log('누락 없음 — 모든 도움말 frontmatter가 완전합니다.');
  for (const { file, missing } of results) console.log(`${file}: ${missing.join(', ')}`);
  console.log(`\n총 ${results.length}개 파일에 누락 항목이 있습니다.`);
}
process.exitCode = results.length > 0 ? 1 : 0;
