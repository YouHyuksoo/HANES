import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const chartSource = readFileSync(new URL('./InspectionHistoryCharts.tsx', import.meta.url), 'utf8');
const locales = Object.fromEntries(
  ['ko', 'en', 'zh', 'vi'].map((lang) => [lang, JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8'))]),
);

test('page toggles between grid and chart view with a header button next to refresh', () => {
  assert.match(pageSource, /const\s+\[viewMode,\s*setViewMode\]\s*=\s*useState<ViewMode>\("grid"\)/);
  assert.match(pageSource, /inspection\.history\.viewChart/);
  assert.match(pageSource, /inspection\.history\.viewGrid/);
  assert.match(pageSource, /aria-pressed=\{isChartView\}/);
  // 차트 버튼과 새로고침 버튼이 같은 헤더 그룹 안에 있다
  assert.match(pageSource, /<div className="flex items-center gap-2">\s*<Button[\s\S]*?viewChart[\s\S]*?<Button[^>]*onClick=\{fetchData\}/);
  assert.match(pageSource, /<InspectionHistoryCharts data=\{data\} fromDate=\{fromDate\} toDate=\{toDate\} \/>/);
});

test('filter bar is shared by both views so switching does not lose filters', () => {
  assert.match(pageSource, /const\s+filterBar\s*=\s*\(/);
  assert.match(pageSource, /toolbarLeft=\{filterBar\}/);
  assert.match(pageSource, /<div className="flex-shrink-0">\{filterBar\}<\/div>/);
});

test('chart view aggregates client-side from the queried rows via the pure chart-data module', () => {
  assert.match(chartSource, /from "\.\/inspectionHistoryChartData"/);
  assert.match(chartSource, /summarizeInspections\(data\)/);
  assert.match(chartSource, /buildTrendSeries\(data,\s*granularity\)/);
  assert.match(chartSource, /buildTypeSeries\(data\)/);
  assert.match(chartSource, /buildTopDefects\(data,\s*TOP_DEFECT_LIMIT\)/);
  assert.doesNotMatch(chartSource, /api\.get/);
});

test('charts use CSS variable tokens, never hex, and stat strip is not a pastel card grid', () => {
  assert.match(chartSource, /var\(--success\)/);
  assert.match(chartSource, /var\(--error\)/);
  assert.doesNotMatch(chartSource, /#[0-9a-fA-F]{6}\b/);
  assert.doesNotMatch(chartSource, /bg-(green|red|blue|sky|amber|indigo)-50/);
  // 합격/불합격은 상태색 → 범례 + 2px 간격(stroke) 보조 인코딩
  assert.match(chartSource, /<Legend/);
  assert.match(chartSource, /stroke=\{TOKEN\.surface\} strokeWidth=\{2\}/);
});

test('chart i18n keys exist in all four locales', () => {
  for (const [lang, json] of Object.entries(locales)) {
    const h = json.inspection.history;
    assert.ok(h.viewChart, `${lang} viewChart`);
    assert.ok(h.viewGrid, `${lang} viewGrid`);
    for (const key of ['total', 'passRate', 'trendHourly', 'trendDaily', 'byType', 'topDefects', 'failCount', 'noData']) {
      assert.ok(h.chart?.[key], `${lang} chart.${key}`);
    }
  }
});
