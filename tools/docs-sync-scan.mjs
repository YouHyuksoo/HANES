#!/usr/bin/env node
/**
 * @file tools/docs-sync-scan.mjs
 * @description 살아있는 문서(sources/verifiedCommit 선언)의 소스 변경량을 git diff로 스캔해 stale 후보를 출력.
 * 사용: node tools/docs-sync-scan.mjs [--json]
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LIVING_DIRS = ['docs/standards', 'docs/design', 'docs/business-logics', 'docs/guides', 'docs/architecture'];
const results = [];

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listMd(full);
    return e.isFile() && e.name.endsWith('.md') ? [full] : [];
  });
}

for (const dir of LIVING_DIRS) {
  for (const file of listMd(dir)) {
    const raw = fs.readFileSync(file, 'utf8');
    const fm = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!fm) { results.push({ file, status: 'no-frontmatter' }); continue; }
    const verified = /verifiedCommit:\s*([0-9a-f]{7,40})/.exec(fm[1])?.[1];
    const sources = [...fm[1].matchAll(/^\s*-\s+(.+)$/gm)].map((m) => m[1].trim());
    if (!verified || verified === 'UNKNOWN' || sources.length === 0) {
      results.push({ file, status: 'untracked', verified: verified ?? null, sourceCount: sources.length });
      continue;
    }
    try {
      const stat = execSync(`git diff --shortstat ${verified}..HEAD -- ${sources.map((s) => `"${s}"`).join(' ')}`, { encoding: 'utf8' }).trim();
      results.push(stat ? { file, status: 'stale', verified, diff: stat } : { file, status: 'fresh', verified });
    } catch {
      results.push({ file, status: 'bad-commit', verified });
    }
  }
}

if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 1));
else {
  for (const r of results.filter((x) => x.status === 'stale')) console.log(`STALE ${r.file} (${r.verified}) ${r.diff}`);
  const c = (s) => results.filter((x) => x.status === s).length;
  console.log(`\nfresh=${c('fresh')} stale=${c('stale')} untracked=${c('untracked')} no-frontmatter=${c('no-frontmatter')} bad-commit=${c('bad-commit')}`);
}
