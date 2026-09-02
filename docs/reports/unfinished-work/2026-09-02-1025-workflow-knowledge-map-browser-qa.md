# 미완료 작업 기록: 워크플로우 지식맵 브라우저 QA

- 작성시각: 2026-09-02 10:25 KST
- 작성자: codex
- 작업 범위: `/workflow` 네 번째 지식맵 탭, 공유 지식 그래프, AI 질문 해석 API
- 현재 상태: 검증대기

## 완료한 것

- 기존 `가이드`, `흐름도`, `전체구성도`를 보존하고 네 번째 `지식맵` 탭을 구현했다.
- 전체 기존 워크플로우를 공유 지식 그래프로 옮기고 검색, 1홉 확장, 7개 관계 범주, 세 레이아웃, 업무/기술 보기를 구현했다.
- AI가 공유 카탈로그의 기존 노드와 허용 관계만 제안하도록 제한된 `POST /ai/workflow-knowledge/interpret`를 구현했다.
- 구현 작업별 명세 검토와 코드 품질 검토를 완료했다.

## 미완료 / 남은 것

- 기능 worktree를 `localhost:3002`에서 실행한 실제 브라우저 QA가 남았다.
- 데스크톱/좁은 화면 렌더, 검색·확장·중심 이동, URL 복원, AI 실패 폴백, 콘솔·네트워크 상태를 Playwright로 확인해야 한다.

## 변경 파일

- `packages/shared/src/workflow/`: 공유 워크플로우·지식 그래프 계약과 탐색 함수
- `apps/backend/src/modules/ai/`: 제한된 지식맵 질문 해석 API
- `apps/frontend/src/app/(authenticated)/workflow/`: 지식맵 상태·레이아웃·컴포넌트·테스트와 네 번째 탭
- `apps/frontend/src/locales/{ko,en,vi,zh}.json`: 지식맵 UI 번역
- `docs/specs/2026-09-02-workflow-knowledge-map-design.md`: 승인 설계
- `docs/plans/2026-09-02-workflow-knowledge-map.md`: 구현 계획

## 검증 상태

- 실행함: `pnpm.cmd --filter @harness/shared typecheck` — exit 0
- 실행함: `pnpm.cmd --filter @harness/shared build` — exit 0
- 실행함: backend focused Jest — 2 suites, 53 tests 통과
- 실행함: frontend workflow Node tests — 37 tests 통과
- 실행함: backend/frontend `tsc --noEmit --pretty false` — 각각 exit 0
- 실행함: `git diff --check` — 통과
- 실행 못함: `http://localhost:3002/workflow` Playwright QA — 메인 worktree의 Next.js 서버(PID 51852)가 지정 포트 3002를 사용 중

## 중단 사유

- 프로젝트 규칙상 다른 포트로 대체할 수 없고, 사용자 허가 없이 기존 메인 worktree 개발 서버를 종료하지 않았다.

## 다음 작업자가 바로 할 일

1. PID 51852의 기존 서버를 안전하게 종료하거나 사용자가 종료했는지 확인한다.
2. `C:/Users/hsyou/.config/superpowers/worktrees/HANES/workflow-knowledge-map`에서 frontend dev 서버를 포트 3002로 실행한다.
3. 구현 계획 Task 7의 데스크톱·모바일 Playwright 시나리오를 실행하고 콘솔·네트워크·스크린샷 근거를 남긴다.

## 주의사항

- 기능 브랜치는 `feature/workflow-knowledge-map`이다.
- 기존 메인 서버나 메인 작업트리의 dirty 변경을 종료·수정·stage하지 않는다.
- 브라우저 QA 전까지 실제 렌더와 상호작용 완료를 주장하지 않는다.
