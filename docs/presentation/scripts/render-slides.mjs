// 소개자료 HTML의 각 슬라이드를 ?slide=N 단일 모드로 열어 1600x900 PNG로 렌더한다.
// 출력: docs/presentation/.pptx-build/slide-NN.png
// 사용: node docs/presentation/scripts/render-slides.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  try { return localRequire('playwright'); }
  catch {
    const appData = process.env.APPDATA;
    const globalRequire = createRequire(path.join(appData, 'npm/node_modules/playwright/package.json'));
    return globalRequire('playwright');
  }
}
const { chromium } = loadPlaywright();

const repoRoot = process.cwd();
const htmlPath = path.join(repoRoot, 'docs/presentation/hanes-mes-introduction.html');
const outDir = path.join(repoRoot, 'docs/presentation/.pptx-build');
const VIEWPORT = { width: 1600, height: 900 };

async function main() {
  const html = await fs.readFile(htmlPath, 'utf8');
  const count = (html.match(/<section class="slide"/g) ?? []).length;
  if (!count) throw new Error('슬라이드를 찾지 못했습니다.');
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const baseUrl = pathToFileURL(htmlPath).href;
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: 'ko-KR' });
    const page = await ctx.newPage();
    for (let i = 1; i <= count; i++) {
      await page.goto(`${baseUrl}?slide=${i}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      const out = path.join(outDir, `slide-${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height } });
      process.stdout.write(`rendered ${i}/${count}\r`);
    }
  } finally {
    await browser.close().catch(() => {});
  }
  console.log(`\n렌더 완료: ${count}장 → ${path.relative(repoRoot, outDir)}`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
