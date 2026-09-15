# 미완료 작업 기록: 관리계획 통합 문서체계 구현

- 작성시각: 2026-09-15 11:25 KST
- 작성자: codex
- 작업 범위: QREKA-PR-025 기반 PFD/PFMEA/Control Plan/개정이력 통합 구현
- 현재 상태: 진행중

## 완료한 것

- Task 1: 공유 문서/Revision/행/검증 타입과 RPN·Revision·참조 정합성 순수규칙을 TDD로 구현했다.
- Task 2: 9개 신규 Entity, tenant FK/unique/check 제약, 9개 Oracle Sequence, DRAFT 단일 function-based index migration을 구현했다.

## 미완료 / 남은 것

- Task 3~13: 채번 서비스, Backend CRUD/Revision/PFD/PFMEA/Control Plan/검증/이관, 통합 UI, 원문 PDF·Excel·인쇄, JSHANES 적용과 브라우저 검증.
- 신규 migration은 아직 JSHANES에 적용하지 않았다.

## 변경 파일

- `packages/shared/src/types/quality-control-plan.ts`: 공유 계약.
- `packages/shared/src/utils/quality-control-plan.rules.ts`: 순수 업무규칙.
- `apps/backend/src/entities/quality-plan-*.entity.ts` 및 행 Entity: 신규 데이터 모델.
- `apps/backend/src/migrations/2026-09-15_quality_plan_document_system.sql`: 신규 스키마.

## 검증 상태

- 실행함: shared 규칙 테스트 5/5 PASS, Entity/migration 구조 테스트 2/2 PASS, shared/backend typecheck PASS, `git diff --check` PASS.
- 실행 못함: Oracle 적용, frontend typecheck, 포트 3002 Playwright, 출력 시각검증은 후속 Task 범위라 아직 실행하지 않았다.
- 참고: 최초 backend typecheck는 격리 worktree에 shared `dist`가 없어 import 오류가 발생했고, shared 패키지 컴파일 후 재실행하여 PASS했다.

## 중단 사유

- 13개 Task 중 안전한 구현 체크포인트(Task 1~2)까지 완료하고 다음 Task로 인계한다.

## 다음 작업자가 바로 할 일

1. `feature/quality-control-plan-doc-system` worktree에서 Task 3 채번 테스트를 RED로 작성한다.
2. `NumberingService`와 신규 `ControlPlanDocumentModule`을 구현하고 backend focused test/typecheck를 실행한다.

## 주의사항

- 작업 경로는 `C:/Project/HANES/.worktrees/quality-control-plan-doc-system`이며 main의 사용자 변경과 분리돼 있다.
- 커밋·push·JSHANES DDL/DML·배포는 수행하지 않았다.
- ID 채번을 `MAX+1`로 바꾸지 말고 반드시 정의된 Sequence의 `NEXTVAL`을 사용한다.
