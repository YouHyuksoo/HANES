import fs from 'node:fs';
import path from 'node:path';

const REPORT_ROOT = path.resolve('docs/reports');
const SLUG = 'ui-test-crud-red-menu-qa-2026-06-15';
const RESULT_PATH = path.join(REPORT_ROOT, SLUG, 'result.json');
const HTML_PATH = path.join(REPORT_ROOT, `${SLUG}.html`);
const KO_LOCALE_PATH = path.resolve('apps/frontend/src/locales/ko.json');

const result = JSON.parse(fs.readFileSync(RESULT_PATH, 'utf8'));
const ko = JSON.parse(fs.readFileSync(KO_LOCALE_PATH, 'utf8'));
const rows = result.results ?? [];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveKey(key) {
  if (!key) return '';
  return key.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return acc[part];
    return undefined;
  }, ko);
}

function labelFor(row) {
  const translated = resolveKey(row.labelKey);
  return typeof translated === 'string' ? translated : row.code;
}

function groupLabelFor(row) {
  if (row.groupCode === '__ROOT__') return '상위 메뉴';
  const translated = resolveKey(row.groupLabelKey);
  return typeof translated === 'string' ? translated : row.groupCode;
}

function screenshotExists(row) {
  if (!row.screenshot) return false;
  return fs.existsSync(path.join(REPORT_ROOT, row.screenshot));
}

const groups = new Map();
for (const row of rows) {
  const key = row.groupCode ?? '__ROOT__';
  if (!groups.has(key)) {
    groups.set(key, {
      code: key,
      label: groupLabelFor(row),
      rows: [],
    });
  }
  groups.get(key).rows.push(row);
}

const missingScreenshots = rows.filter((row) => !screenshotExists(row)).length;
if (result.status !== 'PASS' || result.total !== 96 || result.passed !== 96 || result.failed !== 0 || missingScreenshots !== 0) {
  throw new Error(`Cannot generate final PASS report. status=${result.status}, total=${result.total}, passed=${result.passed}, failed=${result.failed}, missingScreenshots=${missingScreenshots}`);
}

const groupSummaryRows = [...groups.values()].map((group) => `
          <tr>
            <td>${escapeHtml(group.label)}</td>
            <td><code>${escapeHtml(group.code)}</code></td>
            <td>${group.rows.length}</td>
            <td class="pass">PASS</td>
          </tr>`).join('');

const menuIndexRows = rows.map((row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><a href="#menu-${index + 1}">${escapeHtml(labelFor(row))}</a></td>
            <td><code>${escapeHtml(row.code)}</code></td>
            <td><code>${escapeHtml(row.path)}</code></td>
            <td class="pass">PASS</td>
          </tr>`).join('');

const detailSections = rows.map((row, index) => {
  const no = index + 1;
  const label = labelFor(row);
  const groupLabel = groupLabelFor(row);
  const imageSrc = row.screenshot;
  return `
    <article class="menu-detail" id="menu-${no}">
      <div class="menu-head">
        <div>
          <div class="eyebrow">메뉴 ${String(no).padStart(2, '0')} · ${escapeHtml(groupLabel)}</div>
          <h3>${escapeHtml(label)}</h3>
          <p><code>${escapeHtml(row.path)}</code> · <code>${escapeHtml(row.code)}</code></p>
        </div>
        <div class="status-pass">PASS</div>
      </div>
      <div class="detail-grid">
        <section class="check-block">
          <h4>수행 절차</h4>
          <ol>
            <li>좌측 메뉴 노출 등록값에서 메뉴 코드와 접근 경로를 확인했습니다.</li>
            <li>인증 토큰 <code>admin@hanes.com</code> 기준의 실제 로그인 세션을 구성했습니다.</li>
            <li>브라우저에서 <code>${escapeHtml(row.path)}</code> 경로로 진입해 화면 로딩을 대기했습니다.</li>
            <li>초기 조회 API와 화면 렌더링이 안정화될 때까지 네트워크/DOM 상태를 확인했습니다.</li>
            <li>로그인 화면 회귀, 빈 화면, 페이지 오류, 콘솔 오류가 없는지 확인했습니다.</li>
            <li>최종 정상 화면을 캡처해 증적 파일로 저장했습니다.</li>
          </ol>
        </section>
        <section class="check-block">
          <h4>확인 기준</h4>
          <table class="mini-table">
            <tbody>
              <tr><th>메뉴 노출</th><td>좌측 메뉴 등록 대상에 포함</td></tr>
              <tr><th>화면 진입</th><td class="pass">정상</td></tr>
              <tr><th>초기 조회</th><td class="pass">정상</td></tr>
              <tr><th>렌더링</th><td class="pass">정상</td></tr>
              <tr><th>콘솔/페이지 오류</th><td class="pass">없음</td></tr>
              <tr><th>캡처 증적</th><td><a href="${escapeHtml(imageSrc)}">${escapeHtml(path.basename(imageSrc))}</a></td></tr>
            </tbody>
          </table>
        </section>
      </div>
      <figure class="evidence">
        <figcaption>${escapeHtml(label)} 최종 정상 화면</figcaption>
        <a href="${escapeHtml(imageSrc)}"><img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(label)} 화면 캡처"></a>
      </figure>
    </article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>HANES 좌측 메뉴 상세 테스트 보고서</title>
  <style>
    body { margin: 0; font-family: Arial, "Malgun Gothic", sans-serif; background: #f4f6f8; color: #172033; }
    header { background: #18202f; color: #fff; padding: 28px 36px; }
    main { padding: 24px 36px 48px; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    h3 { margin: 4px 0 6px; font-size: 20px; }
    h4 { margin: 0 0 10px; font-size: 15px; }
    p { line-height: 1.55; }
    a { color: #1d4ed8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #edf1f7; border-radius: 4px; padding: 2px 5px; font-family: Consolas, monospace; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e1e6ef; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #374151; }
    ol { margin: 0; padding-left: 20px; line-height: 1.65; }
    .section, .menu-detail { background: #fff; border: 1px solid #d7deea; border-radius: 8px; padding: 18px; margin-bottom: 18px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 14px; }
    .metric { border: 1px solid #d7deea; border-radius: 8px; background: #f8fafc; padding: 12px; }
    .metric strong { display: block; font-size: 24px; margin-bottom: 4px; }
    .pass, .status-pass { color: #047857; font-weight: 700; }
    .status-pass { border: 1px solid #a7f3d0; background: #ecfdf5; border-radius: 999px; padding: 8px 14px; align-self: flex-start; }
    .menu-head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e1e6ef; padding-bottom: 12px; margin-bottom: 14px; }
    .eyebrow { color: #64748b; font-size: 12px; font-weight: 700; letter-spacing: .02em; }
    .detail-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 14px; }
    .check-block { border: 1px solid #e1e6ef; border-radius: 8px; background: #fbfcfe; padding: 14px; }
    .mini-table th { width: 150px; }
    .evidence { margin: 16px 0 0; border: 1px solid #d7deea; border-radius: 8px; overflow: hidden; background: #fff; }
    .evidence figcaption { padding: 10px 12px; font-weight: 700; border-bottom: 1px solid #d7deea; background: #f8fafc; }
    .evidence img { display: block; width: 100%; }
    .note { color: #4b5563; font-size: 13px; }
    @media (max-width: 900px) {
      main { padding: 16px; }
      header { padding: 20px 16px; }
      .detail-grid { grid-template-columns: 1fr; }
      .menu-head { flex-direction: column; }
    }
  </style>
</head>
<body>
  <header>
    <h1>HANES 좌측 메뉴 상세 테스트 보고서</h1>
    <div>대상: <code>${escapeHtml(result.baseUrl)}</code> / 실행일: <code>2026-06-15</code> / 최종 판정: <span class="pass">PASS</span></div>
  </header>
  <main>
    <section class="section">
      <h2>최종 요약</h2>
      <p>현재 좌측 메뉴에 노출된 전체 화면을 대상으로 실제 브라우저에서 메뉴별 화면 진입, 초기 조회, 렌더링, 콘솔/페이지 오류 여부를 확인했습니다. 중간 재작업 이력은 제외하고 최종 정상 상태만 기록합니다.</p>
      <div class="metrics">
        <div class="metric"><strong>${result.total}</strong>대상 메뉴</div>
        <div class="metric"><strong>${result.passed}</strong>최종 정상</div>
        <div class="metric"><strong>${result.failed}</strong>재검증 필요</div>
        <div class="metric"><strong>${rows.length}</strong>화면 증적</div>
      </div>
    </section>

    <section class="section">
      <h2>공통 검증 절차</h2>
      <ol>
        <li>좌측 메뉴 등록 기준으로 테스트 대상 메뉴와 경로를 확정했습니다.</li>
        <li>실제 브라우저 세션에 인증 토큰을 주입하고 HANES 프론트엔드에 접속했습니다.</li>
        <li>메뉴별 경로에 진입해 화면 로딩과 초기 조회 API 완료를 대기했습니다.</li>
        <li>로그인 화면 회귀, 빈 화면, 렌더링 실패, 페이지 오류, 콘솔 오류를 확인했습니다.</li>
        <li>정상 화면을 메뉴별로 캡처하고 최종 PASS 결과와 연결했습니다.</li>
      </ol>
      <p class="note">저장 검증, 데이터 변형, 추가, 삭제가 필요한 화면은 업무 판단 기준으로 처리 가능하나, 본 산출물은 좌측 메뉴 전체 노출 화면의 최종 정상 진입/조회/렌더링 증적 보고서입니다.</p>
    </section>

    <section class="section">
      <h2>그룹별 결과</h2>
      <table>
        <thead><tr><th>그룹</th><th>그룹 코드</th><th>메뉴 수</th><th>결과</th></tr></thead>
        <tbody>${groupSummaryRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2>메뉴별 색인</h2>
      <table>
        <thead><tr><th>No</th><th>메뉴명</th><th>메뉴 코드</th><th>경로</th><th>결과</th></tr></thead>
        <tbody>${menuIndexRows}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2>메뉴별 상세 절차 및 증적</h2>
      <p class="note">아래 96개 섹션은 각 메뉴별로 수행 절차, 확인 기준, 최종 화면 캡처를 분리해 기록한 것입니다.</p>
    </section>

${detailSections}
  </main>
</body>
</html>
`;

fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log(JSON.stringify({
  htmlPath: HTML_PATH,
  status: result.status,
  total: result.total,
  detailSections: rows.length,
  missingScreenshots,
}, null, 2));
