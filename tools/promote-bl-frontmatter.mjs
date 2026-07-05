#!/usr/bin/env node
/**
 * @file tools/promote-bl-frontmatter.mjs
 * @description business-logics 문서의 본문 표기(분석 기준 커밋)를 표준 frontmatter(sources/verifiedCommit)로 승격.
 * 사용: node tools/promote-bl-frontmatter.mjs [--commit]  (기본 dry-run)
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'docs/business-logics';
const APPLY = process.argv.includes('--commit');
let changed = 0, skipped = 0, noAnchor = 0;

for (const name of fs.readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
  const file = path.join(DIR, name);
  const raw = fs.readFileSync(file, 'utf8');
  if (/^﻿?---\r?\n/.test(raw)) { skipped += 1; continue; }        // 이미 frontmatter 있음

  const commitMatch = raw.match(/분석 기준 커밋[:*\s`]*([0-9a-f]{7,40})/);
  const verified = commitMatch ? commitMatch[1].slice(0, 8) : null;
  if (!verified) noAnchor += 1;

  // 본문 백틱 안의 repo 상대 소스 경로 수집 (apps/, packages/ 시작 .ts/.tsx)
  const srcSet = new Set();
  for (const m of raw.matchAll(/`((?:apps|packages)\/[\w\-./()[\]]+?\.tsx?)`/g)) srcSet.add(m[1]);
  const sources = Array.from(srcSet).slice(0, 12);

  const fmLines = ['---'];
  if (sources.length > 0) { fmLines.push('sources:'); sources.forEach((s) => fmLines.push(`  - ${s}`)); }
  else fmLines.push('sources: []');
  fmLines.push(`verifiedCommit: ${verified ?? 'UNKNOWN'}`, '---', '', '');
  if (APPLY) fs.writeFileSync(file, fmLines.join('\n') + raw, 'utf8');
  changed += 1;
}
console.log(JSON.stringify({ changed, skipped, noAnchor, mode: APPLY ? 'applied' : 'dry-run' }));
