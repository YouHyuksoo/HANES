# 미완료 작업 기록: 관리계획 통합 문서체계 Task 7

- 작성시각: 2026-09-15 11:56 KST
- 작성자: codex
- 작업 범위: Backend 패키지/Revision/PFD/PFMEA/Control Plan/추적성
- 현재 상태: 진행중

## 완료한 것

- Task 4: tenant 패키지 생성, 세 문서 REV.00, 발행본 불변성, 개정 복제, 발행 상태전이와 이벤트 API.
- Task 5: PFD DRAFT 행 CRUD 기반, 공정·공통코드 검증, 원자적 재정렬, 연결선 모델.
- Task 6: 고정 PFD 참조 PFMEA 생성, 등급 1~10, 서버 RPN 재계산, 특별특성 코드 검증.
- Task 7: 고정 PFD/PFMEA 참조 Control Plan 생성, PFD 공정값 강제, 100% 주기 차단, 최신 발행본 추적성 전환.

## 미완료 / 남은 것

- Task 8~13: 자동 초안/통합 검증, legacy 이관, 통합 UI/편집기, 공식 출력, JSHANES 및 E2E 검증.
- 일부 행 update/delete API 확장은 후속 편집기 Task와 함께 마무리해야 한다.

## 변경 파일

- `apps/backend/src/modules/quality/control-plan/`: 신규 DTO, Controller, Service와 테스트.
- `apps/backend/src/modules/quality/inspection/services/trace.service.ts`: 최신 PUBLISHED Control Plan 사용.
- `apps/backend/src/modules/quality/inspection/inspection.module.ts`: 신규 Entity 등록.

## 검증 상태

- 실행함: Task 4 서비스 9/9, PFD 5/5, PFMEA 4/4, Control Plan 3/3, trace 3/3, backend typecheck PASS.
- 실행 못함: DB 적용, frontend, 출력, Playwright는 Task 8~13 범위다.

## 중단 사유

- 다음 자동 계속 작업을 위한 안전 체크포인트다.

## 다음 작업자가 바로 할 일

1. Task 8 자동 초안과 발행 검증 테스트를 RED로 작성한다.
2. 검증 snapshot과 발행 차단을 같은 Revision 트랜잭션 흐름에 연결한다.

## 주의사항

- worktree `C:/Project/HANES/.worktrees/quality-control-plan-doc-system`, branch `feature/quality-control-plan-doc-system`.
- JSHANES 적용, 커밋, push, 배포는 아직 수행하지 않았다.
