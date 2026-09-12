/**
 * @file e2e/scenario-runner/report.ts
 * @description 실행 결과를 JSON + 단일 HTML 로 남긴다 (규격서 8절)
 *
 * 스텝별 events 를 그대로 싣는 게 핵심이다.
 * 실패 원인이 "빨간 토스트가 떴다"가 아니라
 * {type:'API_ERROR', status:409, path:'...', errorCode:'...'} 로 남아야 한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ActivityEvent, RunResult, StepResult } from './types';

const VERDICT_STYLE: Record<string, string> = {
  PASS: 'color:#15803d',
  ALREADY_DONE: 'color:#0369a1',
  SKIPPED: 'color:#78716c',
  FAIL: 'color:#b91c1c;font-weight:700',
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function eventLine(e: ActivityEvent): string {
  const parts = [e.type, e.method, e.path, e.status, e.errorCode, e.message].filter(Boolean);
  const line = esc(parts.join(' · '));
  return e.ignored ? `<li style="opacity:.45">${line} <em>(무시됨)</em></li>` : `<li>${line}</li>`;
}

function stepRow(step: StepResult, shotDirName: string): string {
  const shots = step.screenshots
    .map((name) => `<div><img src="${esc(shotDirName)}/${esc(name)}" style="max-width:100%;border:1px solid #ddd"/><div style="font-size:12px;color:#666">${esc(name)}</div></div>`)
    .join('');
  const events = step.events.length
    ? `<ul style="margin:4px 0;padding-left:18px;font-family:ui-monospace,monospace;font-size:12px">${step.events.map(eventLine).join('')}</ul>`
    : '<div style="color:#999;font-size:12px">이벤트 없음</div>';

  return `<tr>
    <td style="text-align:right;color:#666">${step.phase}/${step.index}</td>
    <td><code>${esc(step.action)}</code></td>
    <td>${esc(step.note ?? '')}</td>
    <td style="${VERDICT_STYLE[step.verdict] ?? ''}">${esc(step.verdict)}</td>
    <td style="text-align:right;color:#666">${step.durationMs}ms</td>
    <td>${step.error ? `<div style="color:#b91c1c">${esc(step.error)}</div>` : ''}${events}${shots}</td>
  </tr>`;
}

export function writeReport(result: RunResult, outDir: string, shotDirName: string): { json: string; html: string } {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${result.runId}.json`);
  const htmlPath = path.join(outDir, `${result.runId}.html`);

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');

  const counts = result.steps.reduce<Record<string, number>>((acc, s) => {
    acc[s.verdict] = (acc[s.verdict] ?? 0) + 1;
    return acc;
  }, {});

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(result.title)} — 시나리오 실행 결과</title>
<style>
 body{font-family:system-ui,'Malgun Gothic',sans-serif;margin:24px;color:#1c1917}
 h1{font-size:20px;margin:0 0 4px} .sub{color:#666;font-size:13px;margin-bottom:16px}
 table{border-collapse:collapse;width:100%} td,th{border:1px solid #e7e5e4;padding:6px 8px;vertical-align:top;font-size:13px}
 th{background:#fafaf9;text-align:left} .verdict{font-size:16px;font-weight:700}
</style></head><body>
<h1>${esc(result.title)}</h1>
<div class="sub">
  시나리오 <code>${esc(result.id)}</code> · 실행 <code>${esc(result.runId)}</code><br>
  ${esc(result.startedAt)} → ${esc(result.finishedAt)}
</div>
<p class="verdict" style="${VERDICT_STYLE[result.verdict]}">${esc(result.verdict)}</p>
<p style="color:#666;font-size:13px">${Object.entries(counts).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</p>
<h2 style="font-size:15px">변수</h2>
<pre style="background:#fafaf9;padding:8px;font-size:12px">${esc(JSON.stringify(result.vars, null, 2))}</pre>
<h2 style="font-size:15px">스텝</h2>
<table><thead><tr><th>#</th><th>액션</th><th>설명</th><th>판정</th><th>소요</th><th>이벤트 / 증거</th></tr></thead>
<tbody>${result.steps.map((s) => stepRow(s, shotDirName)).join('')}</tbody></table>
</body></html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');
  return { json: jsonPath, html: htmlPath };
}
