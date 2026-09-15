# 미완료 작업 기록: 관리계획 통합 문서체계 Task 3

- 작성시각: 2026-09-15 11:38 KST
- 작성자: codex
- 작업 범위: 품질 문서번호 채번과 전용 Backend Module
- 현재 상태: 진행중

## 완료한 것

- `nextQualityDocumentNo`가 PFD/PFMEA/Control Plan별 전역 Sequence를 사용해 날짜 포함 문서번호를 생성한다.
- migration에 `SEQ_QUALITY_PFD_NO`, `SEQ_QUALITY_PFMEA_NO`, `SEQ_QUALITY_CP_NO`를 추가했다.
- `ControlPlanDocumentModule`에 신규 Entity 9개와 `SharedModule`을 등록하고 `QualityModule`에서 import/export했다.
- legacy `SpcModule`의 기존 Control Plan 기능은 이관 전까지 유지했다.

## 미완료 / 남은 것

- Task 4~13 전체. 다음은 패키지 CRUD와 공통 Revision 생명주기다.
- 신규 migration은 아직 JSHANES에 적용하지 않았다.

## 변경 파일

- `apps/backend/src/shared/numbering.service.ts`: 품질 문서번호 채번.
- `apps/backend/src/shared/numbering.service.spec.ts`: 채번 회귀 테스트.
- `apps/backend/src/modules/quality/control-plan/control-plan.module.ts`: 전용 모듈.
- `apps/backend/src/modules/quality/quality.module.ts`: 전용 모듈 연결.
- `apps/backend/src/migrations/2026-09-15_quality_plan_document_system.sql`: 문서번호 Sequence.

## 검증 상태

- 실행함: NumberingService 48/48 PASS, 모듈 구조 3/3 PASS, Entity/migration 구조 2/2 PASS, backend typecheck PASS, `git diff --check` PASS.
- 실행 못함: JSHANES 적용, API/UI/Playwright, 출력 검증은 후속 Task 범위다.

## 중단 사유

- Transaction 기반 Revision 생명주기 구현 전 안전 체크포인트다.

## 다음 작업자가 바로 할 일

1. Task 4 서비스 테스트에서 tenant 거부, REV.00, 발행본 변경 거부, 개정 복제, rollback을 RED로 만든다.
2. DTO, Controller, Service를 구현하고 전용 모듈에 등록한다.

## 주의사항

- 작업 경로는 `C:/Project/HANES/.worktrees/quality-control-plan-doc-system`이다.
- Controller/Service placeholder는 만들지 않았으며 Task 4 실제 구현과 함께 등록해야 한다.
- 커밋·push·DB 적용·배포는 수행하지 않았다.
