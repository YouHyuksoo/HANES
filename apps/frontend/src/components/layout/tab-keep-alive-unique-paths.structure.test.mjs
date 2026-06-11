import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./TabKeepAlive.tsx', import.meta.url), 'utf8');

test('TabKeepAlive removes duplicate tab paths before rendering keyed cells', () => {
  assert.match(source, /const openPaths = Array\.from\(\s*new Set\(\s*tabs\s*\.map\(\(t\) => t\.path\)\s*\.filter\(\(p\) => p in pageRegistry\),?\s*\),?\s*\);/s);
  assert.doesNotMatch(source, /const openPaths = tabs\.map\(\(t\) => t\.path\)\.filter\(\(p\) => p in pageRegistry\);/);
  assert.match(source, /\.map\(\(path\) => \(\s*<KeepAliveCell\s+key=\{path\}/s);
});
