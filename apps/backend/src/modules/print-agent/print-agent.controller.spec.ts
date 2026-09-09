/**
 * @file print-agent.controller.spec.ts
 * @description Print Agent 설치 파일 탐색 경로 — git 추적 release/ 가 빌드 산출물 dist/ 보다 우선한다.
 * 배포 서버에는 dist/ 가 없어(.gitignore) 404 JSON 이 내려가던 결함(2026-09-09)의 회귀 테스트.
 */
import { join } from 'path';
import { resolveBinaryPath } from './print-agent.controller';

describe('resolveBinaryPath', () => {
  const cwd = join('C:', 'srv', 'HANES', 'apps', 'backend');
  const release = join(cwd, '..', 'print-agent', 'release', 'hanes-print-agent.exe');
  const dist = join(cwd, '..', 'print-agent', 'dist', 'hanes-print-agent.exe');

  it('환경변수 PRINT_AGENT_BINARY_PATH 가 존재하면 최우선', () => {
    const custom = join('D:', 'agent', 'hanes-print-agent.exe');
    expect(resolveBinaryPath({ PRINT_AGENT_BINARY_PATH: custom }, cwd, (p) => p === custom || p === release)).toBe(custom);
  });

  it('git 추적 release/ 배포본이 dist/ 빌드 산출물보다 먼저 선택된다', () => {
    expect(resolveBinaryPath({}, cwd, (p) => p === release || p === dist)).toBe(release);
  });

  it('release/ 가 없으면 dist/ 로 폴백한다(개발 머신)', () => {
    expect(resolveBinaryPath({}, cwd, (p) => p === dist)).toBe(dist);
  });

  it('어느 후보도 없으면 null (컨트롤러가 404 로 응답)', () => {
    expect(resolveBinaryPath({}, cwd, () => false)).toBeNull();
  });
});
