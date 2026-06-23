import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const reportDate = process.env.HANES_REPORT_DATE ?? new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const reportRoot = path.resolve(`docs/reports/hanes-all-menu-scenario-qa-summary-${reportDate}`);
const indexPath = path.join(reportRoot, 'index.html');
const resultPath = path.join(reportRoot, 'all-menu-summary.json');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadMenus() {
  const source = readFileSync('apps/frontend/src/config/menuConfig.ts', 'utf8');
  const entries = [
    { code: 'DASHBOARD', labelKey: 'menu.dashboard', path: '/dashboard', source: 'top-level' },
    { code: 'WORKFLOW', labelKey: 'menu.workflow', path: '/workflow', source: 'top-level' },
  ];
  const pattern = /\{\s*code:\s*"([^"]+)",\s*labelKey:\s*"([^"]+)",\s*path:\s*"([^"]+)"/g;
  for (const match of source.matchAll(pattern)) {
    entries.push({ code: match[1], labelKey: match[2], path: match[3], source: 'menuConfig' });
  }
  const unique = [];
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.code}:${entry.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

async function listResultFiles() {
  const root = path.resolve('docs/reports');
  if (!existsSync(root)) return [];
  const dirs = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    if (!dir.name.startsWith('hanes-all-menu-scenario-qa-')) continue;
    if (dir.name.startsWith('hanes-all-menu-scenario-qa-summary-')) continue;
    const file = path.join(root, dir.name, 'all-menu-result.json');
    if (existsSync(file)) {
      const stat = await fs.stat(file);
      files.push({ file, reportName: dir.name, mtimeMs: stat.mtimeMs });
    }
  }
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  return files;
}

async function loadEvidence() {
  const files = await listResultFiles();
  const byCode = new Map();
  const runs = [];
  for (const item of files) {
    try {
      const result = JSON.parse(await fs.readFile(item.file, 'utf8'));
      runs.push({
        reportName: item.reportName,
        status: result.status,
        total: result.total,
        pass: result.pass,
        fail: result.fail,
        stoppedReason: result.stoppedReason ?? null,
        resultPath: path.relative(process.cwd(), item.file),
      });
      for (const page of result.pages ?? []) {
        const previous = byCode.get(page.code);
        const evidence = {
          code: page.code,
          path: page.path,
          status: page.status,
          routeStatus: page.routeStatus ?? null,
          reportName: item.reportName,
          pageReport: page.pageReport ? path.join(path.dirname(path.relative(process.cwd(), item.file)), page.pageReport).replaceAll('\\', '/') : null,
          pageResult: page.pageResult ? path.join(path.dirname(path.relative(process.cwd(), item.file)), page.pageResult).replaceAll('\\', '/') : null,
          failedApis: (page.apiCalls ?? []).filter((call) => !call.ok || call.status >= 400),
          pageErrors: page.pageErrors ?? [],
          requestFailures: page.requestFailures ?? [],
          error: page.error ?? null,
          mtimeMs: item.mtimeMs,
        };
        if (!previous || previous.mtimeMs <= evidence.mtimeMs) {
          byCode.set(page.code, evidence);
        }
      }
    } catch (error) {
      runs.push({
        reportName: item.reportName,
        status: 'UNREADABLE',
        error: String(error.message ?? error),
        resultPath: path.relative(process.cwd(), item.file),
      });
    }
  }
  return { runs, byCode };
}

async function writeReports(summary) {
  await fs.mkdir(reportRoot, { recursive: true });
  const rows = summary.menus.map((item) => {
    const statusClass = item.currentStatus === 'PASS' ? 'pass' : item.currentStatus === 'FAIL' ? 'fail' : 'missing';
    const link = item.pageReport ? `<a href="../${escapeHtml(item.pageReport)}">${escapeHtml(item.code)}</a>` : escapeHtml(item.code);
    return [
      '<tr>',
      `<td>${link}</td>`,
      `<td><code>${escapeHtml(item.path)}</code></td>`,
      `<td class="${statusClass}">${escapeHtml(item.currentStatus)}</td>`,
      `<td>${escapeHtml(item.reportName ?? '-')}</td>`,
      `<td>${escapeHtml(item.routeStatus ?? '-')}</td>`,
      `<td>${escapeHtml(item.failureSummary || '')}</td>`,
      '</tr>',
    ].join('');
  }).join('\n');
  const runRows = summary.runs.map((run) => [
    '<tr>',
    `<td>${escapeHtml(run.reportName)}</td>`,
    `<td>${escapeHtml(run.status)}</td>`,
    `<td>${escapeHtml(run.total ?? '-')}</td>`,
    `<td>${escapeHtml(run.pass ?? '-')}</td>`,
    `<td>${escapeHtml(run.fail ?? '-')}</td>`,
    `<td><code>${escapeHtml(run.resultPath)}</code></td>`,
    `<td>${escapeHtml(run.stoppedReason ?? run.error ?? '')}</td>`,
    '</tr>',
  ].join('')).join('\n');
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>HANES 전체 메뉴 QA 누적 요약</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #172033; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 28px; }
    th, td { border: 1px solid #d8dee9; padding: 8px; font-size: 13px; vertical-align: top; }
    th { background: #f3f6fb; text-align: left; }
    .pass { color: #047857; font-weight: 700; }
    .fail { color: #be123c; font-weight: 700; }
    .missing { color: #92400e; font-weight: 700; }
    code { color: #334155; }
  </style>
</head>
<body>
  <h1>HANES 전체 메뉴 QA 누적 요약</h1>
  <p>기준: ${escapeHtml(reportDate)}</p>
  <p>메뉴 총 ${summary.totalMenus}개 / PASS ${summary.pass}개 / FAIL ${summary.fail}개 / 미실행 ${summary.missing}개</p>
  <h2>메뉴별 최신 증거</h2>
  <table><thead><tr><th>메뉴</th><th>Route</th><th>최신 상태</th><th>리포트</th><th>HTTP</th><th>실패 요약</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>사용한 실행 리포트</h2>
  <table><thead><tr><th>리포트</th><th>Status</th><th>Total</th><th>PASS</th><th>FAIL</th><th>JSON</th><th>비고</th></tr></thead><tbody>${runRows}</tbody></table>
</body>
</html>`;
  await fs.writeFile(indexPath, html, 'utf8');
  await fs.writeFile(resultPath, JSON.stringify({ ...summary, indexPath, resultPath }, null, 2), 'utf8');
}

function summarizeFailure(evidence) {
  const parts = [];
  if (evidence.error) parts.push(`runner: ${evidence.error.split('\n')[0]}`);
  for (const call of evidence.failedApis.slice(0, 3)) {
    parts.push(`api ${call.method ?? ''} ${call.url ?? ''} ${call.status ?? ''}`.trim());
  }
  for (const item of evidence.pageErrors.slice(0, 2)) parts.push(`pageerror: ${item}`);
  const requestFailures = evidence.requestFailures.filter((item) => (
    !/fonts\.gstatic\.com|fonts\.googleapis\.com/i.test(item.url)
    && !/^\/api\/(?:health|db-info)$/i.test(item.url)
    && !/^\/api\/master\/companies\/public$/i.test(item.url)
  ));
  for (const item of requestFailures.slice(0, 2)) parts.push(`requestfailed: ${item.method} ${item.url}`);
  return parts.join(' / ');
}

async function main() {
  const menus = loadMenus();
  const { runs, byCode } = await loadEvidence();
  const rows = menus.map((menu) => {
    const evidence = byCode.get(menu.code);
    if (!evidence) {
      return { ...menu, currentStatus: 'MISSING', failureSummary: '실행 증거 없음' };
    }
    return {
      ...menu,
      currentStatus: evidence.status,
      routeStatus: evidence.routeStatus,
      reportName: evidence.reportName,
      pageReport: evidence.pageReport,
      pageResult: evidence.pageResult,
      failureSummary: evidence.status === 'PASS' ? '' : summarizeFailure(evidence),
    };
  });
  const summary = {
    reportDate,
    generatedAt: new Date().toISOString(),
    totalMenus: rows.length,
    pass: rows.filter((item) => item.currentStatus === 'PASS').length,
    fail: rows.filter((item) => item.currentStatus === 'FAIL').length,
    missing: rows.filter((item) => item.currentStatus === 'MISSING').length,
    runs,
    menus: rows,
  };
  await writeReports(summary);
  console.log(JSON.stringify({
    totalMenus: summary.totalMenus,
    pass: summary.pass,
    fail: summary.fail,
    missing: summary.missing,
    indexPath,
    resultPath,
  }, null, 2));
  if (summary.fail > 0 || summary.missing > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
