// Generates SQL to seed SPC_CHARTS + SPC_DATA so the DB source visually matches
// the current MOCK source (same targets, same generation algorithm as
// hv-spc-mock.source.ts / hv-spc-targets.ts, ported verbatim).
//
// Usage:
//   node tools/seed/gen_spc_hv_seed.mjs
//   python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file tools/seed/spc_hv_seed.sql
//
// Re-running regenerates the same 12 SPC_CHARTS rows (PK collision if already seeded —
// delete existing rows first) with a fresh "last 60 days ending today" SPC_DATA window.
import { writeFileSync } from 'node:fs';

const COMPANY = '40';
const PLANT = '1000';
const DAYS = 60;
const TODAY = new Date(); // seed anchored to "now" — ages out of the day-range window over time, same as real measurements would

// ---- ported from hv-spc-targets.ts ----
const HV_SPC_TARGETS = [
  { id: 'ATCUT-CUT-LEN', processCode: 'ATCUT', itemCode: 'N91H00-X9800-C1', characteristic: '절단 길이', subgroupSize: 5, spec: { lsl: 1197, target: 1200, usl: 1203 }, mock: { mean: 1200.2, sigma: 0.55, perDay: 3 } },
  { id: 'ATCUT-STRIP-LEN', processCode: 'ATCUT', itemCode: 'N91H00-X9800-C1', characteristic: '탈피 길이', subgroupSize: 5, spec: { lsl: 11.5, target: 12.0, usl: 12.5 }, mock: { mean: 12.05, sigma: 0.11, perDay: 3, trendPerDay: 0.035 } },
  { id: 'SHDCT-BRAID-LEN', processCode: 'SHDCT', itemCode: 'N91H00-X9800-C2', characteristic: '편조 절단 길이', subgroupSize: 5, spec: { lsl: 24.0, target: 25.0, usl: 26.0 }, mock: { mean: 25.1, sigma: 0.22, perDay: 2 } },
  { id: 'GCRMP-CRIMP-H', processCode: 'GCRMP', itemCode: 'N91H00-X9800-S-A', characteristic: '크림프 높이', subgroupSize: 5, spec: { lsl: 1.90, target: 1.95, usl: 2.00 }, mock: { mean: 1.952, sigma: 0.012, perDay: 4, shiftAtDay: 21, shiftSigma: 1.6 } },
  { id: 'GCRMP-CRIMP-W', processCode: 'GCRMP', itemCode: 'N91H00-X9800-S-A', characteristic: '크림프 폭', subgroupSize: 5, spec: { lsl: 3.10, target: 3.20, usl: 3.30 }, mock: { mean: 3.205, sigma: 0.02, perDay: 4 } },
  { id: 'GCRMP-PULL-F', processCode: 'GCRMP', itemCode: 'N91H00-X9800-S-A', characteristic: '인장강도', subgroupSize: 5, spec: { lsl: 450, target: null, usl: null }, mock: { mean: 612, sigma: 28, perDay: 2, outlierAtSubgroup: 49, outlierSigma: -8 } },
  { id: 'HEXCP-HEX-AF', processCode: 'HEXCP', itemCode: 'N91H00-X9800-S-AB', characteristic: '육각압착 대변거리', subgroupSize: 5, spec: { lsl: 12.80, target: 13.00, usl: 13.20 }, mock: { mean: 13.01, sigma: 0.045, perDay: 3 } },
  { id: 'TUBHT-TUBE-OD', processCode: 'TUBHT', itemCode: 'N91H00-X9800-S', characteristic: '수축 후 튜브 외경', subgroupSize: 5, spec: { lsl: 14.5, target: 15.0, usl: 15.5 }, mock: { mean: 15.02, sigma: 0.13, perDay: 2, shiftAtDay: 12, shiftSigma: -0.9 } },
  { id: 'MASSY-TORQUE', processCode: 'MASSY', itemCode: 'N91H00-X9800', characteristic: '체결 토크', subgroupSize: 5, spec: { lsl: 7.2, target: 8.0, usl: 8.8 }, mock: { mean: 8.02, sigma: 0.18, perDay: 3 } },
  { id: 'AINSP-INS-RES', processCode: 'AINSP', itemCode: 'N91H00-X9800', characteristic: '절연저항', subgroupSize: 5, spec: { lsl: 100, target: null, usl: null }, mock: { mean: 820, sigma: 95, perDay: 3 } },
  { id: 'AINSP-HIPOT-LEAK', processCode: 'AINSP', itemCode: 'N91H00-X9800', characteristic: '내전압 누설전류', subgroupSize: 5, spec: { lsl: null, target: null, usl: 5.0 }, mock: { mean: 1.35, sigma: 0.32, perDay: 3, trendPerDay: 0.06 } },
  { id: 'AINSP-COND-RES', processCode: 'AINSP', itemCode: 'N91H00-X9800', characteristic: '도체저항', subgroupSize: 5, spec: { lsl: null, target: 2.4, usl: 3.0 }, mock: { mean: 2.42, sigma: 0.09, perDay: 3 } },
];
// decimals mirrors hv-spc-targets.ts per-target values
const DECIMALS = {
  'ATCUT-CUT-LEN': 1, 'ATCUT-STRIP-LEN': 2, 'SHDCT-BRAID-LEN': 2, 'GCRMP-CRIMP-H': 3, 'GCRMP-CRIMP-W': 3,
  'GCRMP-PULL-F': 0, 'HEXCP-HEX-AF': 3, 'TUBHT-TUBE-OD': 2, 'MASSY-TORQUE': 2, 'AINSP-INS-RES': 0,
  'AINSP-HIPOT-LEAK': 2, 'AINSP-COND-RES': 3,
};

// ---- ported from hv-spc-mock.source.ts ----
function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
const SAMPLE_TIMES = ['08:30', '11:00', '14:30', '16:45'];
const MOCK_SEED_SALT = 'hv-spc-v7';

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDateLocal(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function rangeStart(days, today) { return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1)); }

function generateMockSubgroups(target, days, today, salt = MOCK_SEED_SALT) {
  const rand = mulberry32(hashSeed(`${salt}:${target.id}:${days}`));
  const m = target.mock;
  const decimals = DECIMALS[target.id];
  const perDay = Math.max(1, Math.min(SAMPLE_TIMES.length, m.perDay));
  const start = rangeStart(days, today);

  const out = [];
  let id = 1;
  let lotSeq = 1;
  for (let dayIdx = 0; dayIdx < days; dayIdx++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayIdx);
    if (d.getDay() === 0) continue; // Sunday off
    const dateKey = fmtDateLocal(d);
    const lotDate = `${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;

    let offset = 0;
    if (m.shiftAtDay !== undefined && dayIdx >= m.shiftAtDay) offset += (m.shiftSigma ?? 0) * m.sigma;
    if (m.trendPerDay !== undefined) offset += m.trendPerDay * m.sigma * dayIdx;

    for (let k = 0; k < perDay; k++) {
      const samples = [];
      for (let s = 0; s < target.subgroupSize; s++) {
        let v = m.mean + offset + normal(rand) * m.sigma;
        if (m.outlierAtSubgroup === id && s === 2) v += (m.outlierSigma ?? 0) * m.sigma;
        samples.push(Number(v.toFixed(decimals + 1)));
      }
      out.push({
        id, date: dateKey, time: SAMPLE_TIMES[k],
        lotNo: `VH1-RM${lotDate}-${String(lotSeq).padStart(5, '0')}`,
        samples,
      });
      id++; lotSeq++;
    }
  }
  return out;
}

// ---- SQL generation ----
function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function sqlNum(v) {
  return v === null || v === undefined ? 'NULL' : String(v);
}

const chartInserts = [];
const dataRows = []; // { chartId, sampleDateSql, subgroupNo, values, mean, range, stdDev, equipCode, remark }

for (const target of HV_SPC_TARGETS) {
  chartInserts.push(
    `INTO SPC_CHARTS (CHART_NO, ITEM_CODE, PROCESS_CODE, CHARACTERISTIC_NAME, CHART_TYPE, SUBGROUP_SIZE, USL, LSL, TARGET, DATA_SOURCE, STATUS, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY) VALUES (${sqlStr(target.id)}, ${sqlStr(target.itemCode)}, ${sqlStr(target.processCode)}, ${sqlStr(target.characteristic)}, 'XBAR_R', ${target.subgroupSize}, ${sqlNum(target.spec.usl)}, ${sqlNum(target.spec.lsl)}, ${sqlNum(target.spec.target)}, 'MANUAL', 'ACTIVE', ${sqlStr(COMPANY)}, ${sqlStr(PLANT)}, SYSTIMESTAMP, 'seed', SYSTIMESTAMP, 'seed')`
  );

  const subgroups = generateMockSubgroups(target, DAYS, TODAY);
  const equipRotation = []; // no equipCodes list ported (DB target has none) — assign plausible per-process equip codes
  const EQUIP_BY_PROCESS = {
    ATCUT: ['EQ-ATCUT-01', 'EQ-ATCUT-02'], SHDCT: ['EQ-SHDRM-01'], GCRMP: ['EQ-CRMPF-01', 'EQ-CRMPF-02', 'EQ-CRMPR-01'],
    HEXCP: ['EQ-HEXCP-01', 'EQ-HEXCP-02'], TUBHT: ['EQ-TUBHT-01'], MASSY: ['EQ-MASSY-01', 'EQ-MTASY-01'], AINSP: ['EQ-AINSP-01', 'EQ-AINSP-02'],
  };
  const equipPool = EQUIP_BY_PROCESS[target.processCode] ?? ['EQ-GEN-01'];

  for (const sg of subgroups) {
    const n = sg.samples.length;
    const mean = sg.samples.reduce((a, b) => a + b, 0) / n;
    const range = Math.max(...sg.samples) - Math.min(...sg.samples);
    const variance = sg.samples.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    const equipCode = equipPool[(sg.id - 1) % equipPool.length];
    dataRows.push({
      chartId: target.id,
      sampleDateSql: `TO_TIMESTAMP('${sg.date} ${sg.time}:00', 'YYYY-MM-DD HH24:MI:SS')`,
      subgroupNo: sg.id,
      values: JSON.stringify(sg.samples),
      mean: mean.toFixed(4), range: range.toFixed(4), stdDev: stdDev.toFixed(4),
      equipCode, remark: sg.lotNo,
    });
  }
}

// SPC_CHARTS: single INSERT ALL (only 12 rows)
let sql = `-- SPC 시드 데이터 — HV_SPC_TARGETS(12) + MOCK 알고리즘으로 생성한 ${DAYS}일치 서브그룹\n`;
sql += `-- 생성 시각: ${TODAY.toISOString()} (오늘 기준 최근 ${DAYS}일 — 시간이 지나면 오래된 데이터부터 조회창을 벗어남, 실측 데이터와 동일한 동작)\n\n`;
sql += `INSERT ALL\n${chartInserts.join('\n')}\nSELECT 1 FROM DUAL;\n/\n\n`;

// SPC_DATA: chunk into batches of 150 rows per INSERT ALL to keep statements reasonably sized
const CHUNK = 150;
let seq = 1;
for (let i = 0; i < dataRows.length; i += CHUNK) {
  const chunk = dataRows.slice(i, i + CHUNK);
  const intos = chunk.map((r) => {
    const thisSeq = seq++;
    return `INTO SPC_DATA (CHART_ID, SAMPLE_DATE, SEQ, SUBGROUP_NO, "VALUES", MEAN, RANGE_VAL, STD_DEV, OUT_OF_CONTROL, EQUIP_CODE, REMARK, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY) VALUES (${sqlStr(r.chartId)}, ${r.sampleDateSql}, ${thisSeq}, ${r.subgroupNo}, ${sqlStr(r.values)}, ${r.mean}, ${r.range}, ${r.stdDev}, 0, ${sqlStr(r.equipCode)}, ${sqlStr(r.remark)}, ${sqlStr(COMPANY)}, ${sqlStr(PLANT)}, SYSTIMESTAMP, 'seed')`;
  });
  sql += `INSERT ALL\n${intos.join('\n')}\nSELECT 1 FROM DUAL;\n/\n\n`;
}

writeFileSync(new URL('./spc_hv_seed.sql', import.meta.url), sql, 'utf8');
console.log(`charts=${HV_SPC_TARGETS.length} dataRows=${dataRows.length} chunks=${Math.ceil(dataRows.length / CHUNK)}`);
