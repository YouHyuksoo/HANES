#!/usr/bin/env node
/**
 * @file tools/backfill-doc-sources.mjs
 * @description 살아있는 문서(standards/design/business-logics/guides/architecture)의 frontmatter
 * sources를 본문이 언급하는 실제 소스 파일로 채운다. 본문의 경로 직접언급 + 심볼(클래스/훅)을
 * 코드베이스 export 인덱스로 resolve해 "실존 검증된" 파일만 넣는다. verifiedCommit은 현재 HEAD.
 * 사용: node tools/backfill-doc-sources.mjs [--commit]  (기본 dry-run)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const LIVING_DIRS = ['docs/standards', 'docs/business-logics', 'docs/guides', 'docs/architecture', 'docs/design'];
// 다른 AI가 lock 중인 파일은 건드리지 않는다.
const LOCKED = new Set(['docs/standards/master-part-page-standard.md', 'docs/standards/ui-screen-patterns.md']);
const APPLY = process.argv.includes('--commit');
const HEAD = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const MAX_SOURCES = 12;

// --- 1) 심볼 → 파일 인덱스 (export class/function/const, 그리고 파일명 basename) ---
function listSource(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.next') return [];
    if (e.isDirectory()) return listSource(full);
    return /\.(ts|tsx|js|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts') ? [full] : [];
  });
}
const symbolIndex = new Map(); // symbol -> Set<relpath>
function addSymbol(sym, rel) {
  if (!symbolIndex.has(sym)) symbolIndex.set(sym, new Set());
  symbolIndex.get(sym).add(rel);
}
for (const file of [...listSource('apps/backend/src'), ...listSource('apps/frontend/src'), ...listSource('packages')]) {
  const rel = file.replace(/\\/g, '/');
  const raw = fs.readFileSync(file, 'utf8');
  for (const m of raw.matchAll(/export\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Z]\w+)/g)) addSymbol(m[1], rel);
  for (const m of raw.matchAll(/export\s+(?:default\s+)?function\s+([A-Za-z]\w+)/g)) addSymbol(m[1], rel);
  for (const m of raw.matchAll(/export\s+const\s+([A-Za-z]\w+)/g)) addSymbol(m[1], rel);
}

function resolveSymbol(sym) {
  const set = symbolIndex.get(sym);
  if (!set || set.size === 0) return null;
  if (set.size === 1) return [...set][0];
  // 모호하면(여러 파일) 채택하지 않는다 — 오탐 방지.
  return null;
}

// --- 2) 문서별 소스 후보 추출 ---
function extractSources(body) {
  const found = new Set();
  // 직접 경로 언급 (백틱 유무 무관)
  for (const m of body.matchAll(/(apps|packages|tools)\/[A-Za-z0-9_./()[\]-]+?\.(ts|tsx|js|mjs|py|json)/g)) {
    const p = m[0].replace(/[()[\]]/g, '');
    if (fs.existsSync(p)) found.add(p);
  }
  // 심볼: PascalCase + 역할접미사, 또는 useXxx 훅
  const symRe = /\b([A-Z][A-Za-z0-9]*(?:Service|Controller|Module|Entity|Store|Panel|Modal|Guard|Interceptor|Repository|Dto|Resolver)|use[A-Z][A-Za-z0-9]+)\b/g;
  for (const m of body.matchAll(symRe)) {
    const r = resolveSymbol(m[1]);
    if (r) found.add(r);
  }
  return [...found].sort().slice(0, MAX_SOURCES);
}

// --- 3) frontmatter 파싱/쓰기 ---
function splitFrontmatter(raw) {
  const m = /^(﻿?)---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { has: false, bom: raw.charCodeAt(0) === 0xfeff, fm: '', body: raw };
  return { has: true, bom: !!m[1], fm: m[2], body: raw.slice(m[0].length) };
}

const stats = { filled: 0, alreadyHasSources: 0, noCandidates: 0, locked: 0, files: [] };
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
    const rel = file.replace(/\\/g, '/');
    if (LOCKED.has(rel)) { stats.locked += 1; continue; }
    const raw = fs.readFileSync(file, 'utf8');
    const { has, fm, body } = splitFrontmatter(raw);
    // 이미 sources에 항목이 있으면 건드리지 않는다.
    const hasNonEmptySources = has && /sources:\s*\n\s*-\s+\S/.test(fm);
    if (hasNonEmptySources) { stats.alreadyHasSources += 1; continue; }
    const contentForScan = has ? body : raw;
    const sources = extractSources(contentForScan);
    if (sources.length === 0) {
      stats.noCandidates += 1;
      // frontmatter 자체가 없는 순수 규칙 문서는 sources:[]로 추적 계약만 명시(추적할 소스 없음).
      if (!has) {
        const emptyFm = ['---', 'sources: []', `verifiedCommit: ${HEAD}`, '---', ''].join('\n');
        if (APPLY) fs.writeFileSync(file, emptyFm + `\n${raw}`, 'utf8');
        stats.declaredEmpty = (stats.declaredEmpty || 0) + 1;
      }
      continue;
    }

    // frontmatter 재구성: 기존 verifiedCommit 유지(있으면), 없으면 HEAD
    let verified = HEAD;
    if (has) {
      const vm = /verifiedCommit:\s*([0-9a-fA-F]{4,40}|UNKNOWN)/.exec(fm);
      if (vm && vm[1] !== 'UNKNOWN') verified = vm[1];
    }
    const fmLines = ['---', 'sources:'];
    sources.forEach((s) => fmLines.push(`  - ${s}`));
    fmLines.push(`verifiedCommit: ${verified}`, '---', '');
    const newRaw = fmLines.join('\n') + (has ? body : `\n${raw}`);
    if (APPLY) fs.writeFileSync(file, newRaw, 'utf8');
    stats.filled += 1;
    stats.files.push({ file: rel, count: sources.length });
  }
}

console.log(JSON.stringify({ mode: APPLY ? 'applied' : 'dry-run', ...stats, files: stats.files.slice(0, 8) }, null, 1));
console.log(`filled=${stats.filled} alreadyHasSources=${stats.alreadyHasSources} noCandidates=${stats.noCandidates} locked=${stats.locked}`);
