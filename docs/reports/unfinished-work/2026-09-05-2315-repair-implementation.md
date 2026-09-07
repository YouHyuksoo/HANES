# 미완료 작업 기록: 수리 기능 구현 후 실제 DB 검증

- 작성시각: 2026-09-05 23:15 KST
- 작성자: codex-repair
- 작업 범위: /production/repair 시작·재검사·종결·재고 연계 구현
- 현재 상태: 검증대기

## 완료한 것

- 앞선 카드 제거를 유지하고, 접수 저장 후 같은 창에서 수리 시작 → 수리완료/재검사 → 합격 종결 또는 불합격 재수리를 이어가도록 구현.
- 전용 start/complete/inspect 액션, shared 상태 규칙, 마스터/시리얼 검증, 날짜 정규화 및 과거 시각 포함 DATE 조회, 빈 사용부품 삭제 반영.
- 수리 인수·원자재 부품 LOT 소비·양품 복귀·폐기·검사이력·FG 라벨 상태를 단일 QueryRunner에서 저장. 부족 재고는 새로 만들지 않고 차단.
- 제품수불 취소 2경로, 자재출고 취소, 원자재 직접 취소에서 수리 연결 원장만 차단.
- 수리중 FG는 기존 외관검사/외관상태변경/통전재검사/라벨취소 4경로에서 잠금 후 외부 변경을 차단.
- TXN-REPAIR-001 오더-제품수불 정합 규칙 추가.
- docs/business-logics/PROD_REPAIR.md에 실제 처리와 변경 영향 지도 갱신.

## 미완료 / 남은 것

- 실제 JSHANES 인증/공통코드/창고/LOT/재고를 사용하는 종단 검증. DB 접속 실패로 실제 등록·시작·재검사·종결을 실행하지 못함.
- 실제 상태코드 REPAIR_STATUS/결과/재처리 공통코드 유효성 및 재고 실물 위치 확인.
- 현재 FG 외관불합격은 기존 검사 로직이 재고 품질을 전환하지 않으므로 GOOD에서 인수, 수동 품목 수리는 DEFECT에서 인수한다. 이미 수동으로 DEFECT 이관된 FG의 출처 정합은 운영 검증 필요.
- 지원 범위: FG 외관불합격 시리얼(수량1), 반제품/완제품의 수량 단위 수리, 원자재 사용부품, 재검사 전량 PASS/FAIL. SG 묶음 시리얼 잔량 분배/부분 재검사/제품 품목 자체를 사용부품으로 소비하는 흐름은 구현 범위 밖.
- 수리 시작 원장이 없는 과거 IN_REPAIR 데이터는 자동 재고 생성 없이 완료 차단. 실제 존재 여부는 DB 미조회 상태.

## 변경 파일

- apps/backend/src/modules/production/{controllers/repair.controller.ts,dto/repair.dto.ts,production.module.ts,services/repair*.ts}
- apps/frontend/src/app/(authenticated)/production/repair/ 하위 폼/액션/LOT배분/상태/문구/테스트
- packages/shared/src/utils/{repair-rules.ts,index.ts}
- apps/backend/src/modules/inventory/services/{inventory,product-inventory}.service.ts 및 spec
- apps/backend/src/modules/material/services/mat-issue.service.ts 및 spec
- apps/backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts 및 spec
- apps/backend/src/modules/master/validation/rules/txn-invariant.rules.ts
- docs/business-logics/PROD_REPAIR.md 및 coordination 기록

## 검증 상태

- 실행함: backend focused Jest 10 suites 178/178 PASS(수리 CRUD/상태/대상/재고/shared 규칙, 원자재/제품재고, 자재출고, 외관검사, 불변식).
- 실행함: shared/backend/frontend tsc --noEmit exit 0.
- 실행함: frontend repair-columns.structure.test.mjs 2/2 + repair-workflow.ui.test.mjs 1/1 PASS.
- UI 시나리오: 실제 localhost:3002에서 저장 → 수리 시작 → REINSPECT → FAIL → 재수리 → REINSPECT → PASS → COMPLETED/저장비활성. API는 전부 모의 응답, 실DB 테스트가 아님. 미저장 상태의 다음 액션 차단도 확인. 브라우저 콘솔 pageerror 없음.
- Playwright CLI 세션이 종료되는 환경 문제로 같은 포트에서 설치된 Playwright 라이브러리의 독립 브라우저로 검증. 서버/포트 변경 없음. 중복 label ID 결함을 이 테스트로 발견하고 수정함.
- scoped git diff --check 통과.
- 실제 JSHANES oracle-db SELECT 최초/최종 재시도 모두 DPY-6005 cannot connect, timed out. 최종 쿼리는 수리 건수와 REPAIR_STATUS 코드 건수 조회이며 결과 없음.
- 이전 실제 브라우저 인증은 /api/auth/me 401. 실DB 연결 실패를 모의 UI 성공으로 대체 보고하지 않음.

## 중단 사유

- 구현 및 로컬 검증 완료. 실제 DB 연결이 불가하여 운영 데이터 적용/동시성/롤백 종단 확인은 미완료.

## 다음 작업자가 바로 할 일

1. JSHANES 연결 및 정상 인증을 복구하고 실제 공통코드와 재고 출처부터 조회.
2. 지원 대상 테스트 건으로 접수 → 시작 → 재사용/폐기/재검사FAIL→PASS, 부품 LOT 소비와 취소차단을 실제 API/DB에서 검증하고 테스트 데이터 정리.
3. 실제 REPAIR_ORDERS, PRODUCT_TRANSACTIONS, MAT_ISSUES, STOCK_TRANSACTIONS, INSPECT_RESULTS, FG_LABELS 정합성과 TXN-REPAIR-001 검사 결과 확인.

## 주의사항

- 기존 타 작업 dirty 파일 보존. 실제 업무 데이터 생성/수정/삭제 없음; 잔여 테스트 데이터 없음.
- 기존 스키마/시퀀스/공통코드 값을 재사용. DB 스키마 변경이나 추정 DDL/seed를 실행하지 않음.
- 커밋/푸시/배포는 요청되지 않아 수행하지 않음. production build 및 서버 재시작 없음.