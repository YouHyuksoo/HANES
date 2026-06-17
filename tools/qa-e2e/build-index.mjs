/**
 * 기준정보 상세 QA 목차(index) 생성기.
 *
 * docs/reports/hanes-master-detailed-qa/<screen>/result.json 들을 모아
 * 화면 단위로 분리된 개별 리포트로 연결되는 목차 index.html 을 생성한다.
 *
 * 사용: node tools/qa-e2e/build-index.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const baseDir = path.resolve('docs/reports/hanes-master-detailed-qa');

function htmlEscape(v) {
  return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

async function main() {
  let entries = [];
  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true });
  } catch {
    console.error(`결과 폴더가 없습니다: ${baseDir}`);
    process.exitCode = 1;
    return;
  }

  const screens = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const rp = path.join(baseDir, e.name, 'result.json');
    try {
      screens.push(JSON.parse(await fs.readFile(rp, 'utf8')));
    } catch {
      /* result.json 없는 폴더 무시 */
    }
  }
  screens.sort((a, b) => (a.menuLabel ?? a.id).localeCompare(b.menuLabel ?? b.id, 'ko'));

  const totalScreens = screens.length;
  const passScreens = screens.filter((s) => s.status === 'PASS').length;
  const totalCases = screens.reduce((n, s) => n + (s.total ?? 0), 0);
  const passCases = screens.reduce((n, s) => n + (s.pass ?? 0), 0);

  const statusBadge = (s) => s === 'PASS'
    ? '<span class="badge pass">PASS</span>'
    : '<span class="badge fail">FAIL</span>';

  const rows = screens.map((s, i) => {
    const caseChips = (s.cases ?? []).map((c) =>
      `<span class="chip ${c.status === 'PASS' ? 'ok' : 'ng'}" title="${htmlEscape(c.title)} — ${htmlEscape(c.actual || c.error || '')}">${htmlEscape(c.title)}</span>`).join('');
    return `<tr class="${s.status === 'FAIL' ? 'rowfail' : ''}">
      <td class="num">${i + 1}</td>
      <td><a href="${htmlEscape(s.reportRel)}"><strong>${htmlEscape(s.menuLabel ?? s.id)}</strong></a><div class="route">${htmlEscape(s.route)}</div></td>
      <td class="center">${statusBadge(s.status)}</td>
      <td class="center">${s.pass}/${s.total}</td>
      <td class="cases">${caseChips}</td>
      <td class="center"><a class="open" href="${htmlEscape(s.reportRel)}">리포트 열기 →</a></td>
    </tr>`;
  }).join('');

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>HANES 기준정보 상세 E2E QA — 목차</title>
<style>
  body{font-family:'Malgun Gothic',Arial,sans-serif;margin:0;background:#f6f7f9;color:#111827}
  header{padding:26px 34px;background:#0f172a;color:#fff}
  header h1{margin:0 0 8px;font-size:24px}
  header .sub{color:#94a3b8;font-size:14px}
  main{padding:22px 34px 56px;max-width:1280px}
  .kpis{display:flex;gap:14px;margin-bottom:20px;flex-wrap:wrap}
  .kpi{background:#fff;border:1px solid #d8dee8;border-radius:10px;padding:14px 20px;min-width:150px}
  .kpi .v{font-size:26px;font-weight:800}
  .kpi .l{font-size:12px;color:#6b7280;margin-top:2px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d8dee8;border-radius:10px;overflow:hidden}
  th,td{padding:11px 13px;border-bottom:1px solid #eef1f5;font-size:14px;vertical-align:top;text-align:left}
  th{background:#f1f5f9;font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:.03em}
  td.num{color:#94a3b8;width:36px}
  td.center{text-align:center;white-space:nowrap}
  .route{color:#64748b;font-size:12px;margin-top:2px;font-family:ui-monospace,monospace}
  tr.rowfail td{background:#fef2f2}
  .badge{padding:2px 9px;border-radius:6px;font-size:12px;font-weight:700;color:#fff}
  .badge.pass{background:#16a34a}.badge.fail{background:#dc2626}
  .cases{max-width:520px}
  .chip{display:inline-block;margin:2px 3px;padding:2px 7px;border-radius:5px;font-size:11px;border:1px solid}
  .chip.ok{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}
  .chip.ng{background:#fef2f2;border-color:#fecaca;color:#b91c1c}
  a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
  .open{font-size:13px;font-weight:600}
  .empty{padding:30px;text-align:center;color:#94a3b8}
</style></head><body>
<header>
  <h1>HANES 기준정보(Master) 상세 E2E QA — 목차</h1>
  <div class="sub">Playwright 실제 UI 구동 · 정상/비정상(필수값·중복RED) 입력 검증 · 화면 단위 분리 리포트</div>
</header>
<main>
  <div class="kpis">
    <div class="kpi"><div class="v">${passScreens}/${totalScreens}</div><div class="l">화면 PASS</div></div>
    <div class="kpi"><div class="v">${passCases}/${totalCases}</div><div class="l">케이스 PASS</div></div>
  </div>
  ${screens.length
    ? `<table><thead><tr><th>#</th><th>화면(메뉴)</th><th>결과</th><th>케이스</th><th>검증 항목</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    : '<div class="empty">생성된 화면 리포트가 없습니다. 먼저 runner.mjs 로 시나리오를 실행하세요.</div>'}
</main></body></html>`;

  const out = path.join(baseDir, 'index.html');
  await fs.writeFile(out, html, 'utf8');
  console.log(`목차 생성 완료: ${out}\n  화면 ${passScreens}/${totalScreens} PASS, 케이스 ${passCases}/${totalCases} PASS`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
