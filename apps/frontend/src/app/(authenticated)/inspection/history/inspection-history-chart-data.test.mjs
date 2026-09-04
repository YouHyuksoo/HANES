import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeInspections,
  resolveTrendGranularity,
  buildTrendSeries,
  buildTypeSeries,
  buildTopDefects,
} from './inspectionHistoryChartData.ts';

const row = (over) => ({
  resultNo: 'R', prodResultNo: null, inspectType: 'VISUAL', inspectScope: 'FULL',
  passYn: 'Y', fgBarcode: null, errorCode: null, errorDetail: null,
  inspectAt: '2026-09-04T09:15:00', inspectorId: null, ...over,
});

const rows = [
  row({ passYn: 'Y', inspectAt: '2026-09-04T09:15:00' }),
  row({ passYn: 'N', errorCode: 'E01', inspectAt: '2026-09-04T09:45:00' }),
  row({ passYn: 'N', errorCode: 'E01', inspectType: 'TERMINAL', inspectAt: '2026-09-04T11:05:00' }),
  row({ passYn: 'Y', inspectType: 'CONTINUITY', inspectAt: '2026-09-05T08:00:00' }),
  row({ passYn: 'N', errorCode: 'E02', inspectType: 'CONTINUITY', inspectAt: '2026-09-05T08:30:00' }),
];

test('summarizeInspections counts pass/fail and rounds pass rate to one decimal', () => {
  const s = summarizeInspections(rows);
  assert.deepEqual(s, { total: 5, pass: 2, fail: 3, passRate: 40 });
  assert.deepEqual(summarizeInspections([]), { total: 0, pass: 0, fail: 0, passRate: null });
  assert.equal(summarizeInspections([row(), row(), row({ passYn: 'N' })]).passRate, 66.7);
});

test('resolveTrendGranularity is hourly for a single day and daily otherwise', () => {
  assert.equal(resolveTrendGranularity('2026-09-04', '2026-09-04'), 'hour');
  assert.equal(resolveTrendGranularity('2026-09-01', '2026-09-04'), 'day');
  assert.equal(resolveTrendGranularity('', ''), 'day');
});

test('buildTrendSeries buckets by hour with zero-filled gaps between first and last bucket', () => {
  const dayOne = rows.filter((r) => r.inspectAt.startsWith('2026-09-04'));
  const series = buildTrendSeries(dayOne, 'hour');
  assert.deepEqual(series.map((p) => p.bucket), ['09:00', '10:00', '11:00']);
  assert.deepEqual(series[0], { bucket: '09:00', pass: 1, fail: 1 });
  assert.deepEqual(series[1], { bucket: '10:00', pass: 0, fail: 0 });
  assert.deepEqual(series[2], { bucket: '11:00', pass: 0, fail: 1 });
});

test('buildTrendSeries buckets by day in chronological order', () => {
  const series = buildTrendSeries(rows, 'day');
  assert.deepEqual(series, [
    { bucket: '09-04', pass: 1, fail: 2 },
    { bucket: '09-05', pass: 1, fail: 1 },
  ]);
});

test('buildTrendSeries ignores rows with unparseable inspectAt', () => {
  const series = buildTrendSeries([row({ inspectAt: 'garbage' }), row()], 'hour');
  assert.deepEqual(series, [{ bucket: '09:00', pass: 1, fail: 0 }]);
});

test('buildTypeSeries groups by inspect type in fixed order VISUAL, TERMINAL, CONTINUITY then others', () => {
  const series = buildTypeSeries([...rows, row({ inspectType: 'OTHER', passYn: 'N' })]);
  assert.deepEqual(series.map((p) => p.type), ['VISUAL', 'TERMINAL', 'CONTINUITY', 'OTHER']);
  assert.deepEqual(series[0], { type: 'VISUAL', pass: 1, fail: 1, passRate: 50 });
  assert.deepEqual(series[1], { type: 'TERMINAL', pass: 0, fail: 1, passRate: 0 });
  assert.deepEqual(series[3], { type: 'OTHER', pass: 0, fail: 1, passRate: 0 });
});

test('buildTopDefects counts failed rows per error code, sorted desc, limited to N, ignoring blanks', () => {
  const defects = buildTopDefects([...rows, row({ passYn: 'N', errorCode: '' }), row({ passYn: 'N' })], 1);
  assert.deepEqual(defects, [{ code: 'E01', count: 2 }]);
  assert.deepEqual(buildTopDefects(rows, 10), [{ code: 'E01', count: 2 }, { code: 'E02', count: 1 }]);
});
