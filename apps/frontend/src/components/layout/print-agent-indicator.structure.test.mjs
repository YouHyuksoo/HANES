import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./PrintAgentIndicator.tsx', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../../services/print-agent.ts', import.meta.url), 'utf8');

// 배포 서버에 exe 가 없으면 /download 가 404 JSON 을 내려 브라우저가 download.json 을 저장하던 결함(2026-09-09).
test('PrintAgentIndicator는 서버 설치 파일 유무(/print-agent/info)를 확인한 뒤에만 다운로드 링크를 그린다', () => {
  assert.match(serviceSource, /export const PRINT_AGENT_INFO_URL = "\/api\/print-agent\/info"/);
  assert.match(serviceSource, /export async function fetchPrintAgentInstallerInfo\(/);
  assert.match(source, /fetchPrintAgentInstallerInfo\(\)/);
  assert.match(source, /installerAvailable === false \?/);
  assert.match(source, /printAgent\.installerUnavailable/);
  // 링크는 파일이 있을 때(또는 미확인)만 — 무조건 렌더되는 <a download> 는 없어야 한다
  const linkIndex = source.indexOf('href={PRINT_AGENT_DOWNLOAD_URL}');
  const guardIndex = source.indexOf('installerAvailable === false ?');
  assert.ok(guardIndex > -1 && linkIndex > guardIndex, '다운로드 링크는 설치 파일 유무 분기 안에 있어야 한다');
  assert.doesNotMatch(source, /alert\(|confirm\(|prompt\(/);
  assert.doesNotMatch(source, /bg-(red|green|amber|yellow|blue)-50\b/);
});
