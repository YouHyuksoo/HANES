# 미완료 작업 기록: 수리 정보카드 제거 및 프로세스 점검

- 작성시각: 2026-09-05 22:22 KST
- 작성자: codex-repair
- 작업 범위: /production/repair 통계카드 제거, 화면 → Controller → Service → Entity 읽기 전용 점검
- 현재 상태: 검증대기

## 완료한 것

- HEAD e2b1fa8f 및 현재 working tree 확인. 기존 타 작업 변경 보존.
- page.tsx의 입고/수리중/완료 StatCard 3개와 계산/import 제거. 스크롤 컨테이너 min-h-0, 그리드 가용 높이 확대.
- RepairFormModal → repair.controller.ts → repair.service.ts → RepairOrder/RepairUsedPart 저장 체인 확인.

## 미완료 / 남은 것

아래는 현재 소스에서 확인한 문제이며 운영 DB 재현 결과가 아니다. 이번에는 카드 제거만 구현했고 업무 로직은 수정하지 않았다.

1. **등록 직후 상세조회 키 불일치**: RepairFormModal.handleSave는 repairDate를 제출하지 않음. service.create:146-149는 현재 시각 new Date()를 REPAIR_DATE(Oracle DATE)에 저장. findOne/update/remove는 parseDateStart로 자정과 동등 비교. 프론트 행 클릭도 날짜만 URL에 전달한다. DB 트리거의 날짜 정규화 여부는 연결 실패로 미확인.
2. **수리 시작 없음**: create는 항상 RECEIVED, update는 disposition이 PENDING 외 값이면 바로 COMPLETED. DTO/화면/서비스에 IN_REPAIR로 전환하는 기능 없음. REPAIR_RESULT의 IN_PROGRESS를 선택해도 status는 바뀌지 않음.
3. **완료 기준 불일치**: 신규등록에서 disposition=REUSE/SCRAP 등을 지정해도 RECEIVED. 같은 값으로 수정하면 결과/재검사/복귀공정 확인 없이 COMPLETED. 완료된 행의 수정도 제한하지 않아 PENDING 등으로 결과를 바꾸고도 COMPLETED 상태 유지.
4. **후속 처리 미연결**: 수리 서비스는 REPAIR_ORDERS와 REPAIR_USED_PARTS만 저장. REINSPECT의 검사 지시/판정, REUSE의 공정복귀/재고이동, SCRAP의 폐기수불, 사용부품의 재고차감 호출 없음. returnProcess는 문자열 저장뿐. getInventory는 미완료 수리오더 목록이며 실제 창고재고가 아님. DB 트리거 보완 여부는 미확인.
5. **사용부품 전체 삭제 미반영**: RepairFormModal:192는 빈 배열을 undefined로 생략. service.update:243은 usedParts가 undefined이면 기존 부품 보존. 화면에서 마지막 부품을 제거 후 저장해도 기존 부품이 남는 요청/서버 조합.
6. **상태 필터 코드 불일치**: page.tsx:165는 statusFilter 선택에 REPAIR_RESULT 사용. 실제 상태는 RECEIVED/IN_REPAIR/COMPLETED, 결과 seed는 COMPLETED/IMPOSSIBLE/IN_PROGRESS. 컬럼 배지는 REPAIR_STATUS 사용. 실제 DB 공통코드 조회는 실패.
7. **스캔 연계 미구현**: RepairFormModal.handleBarcodeScan은 문자열 정리/포커스만 처리하며 제품/품목/원불량 조회는 없음. 품목은 수동 선택.

## 변경 파일

- apps/frontend/src/app/(authenticated)/production/repair/page.tsx: 카드 및 통계 제거, min-h-0 및 가용 높이 조정.
- 이 기록과 coordination 작업/검증 기록.

## 검증 상태

- frontend: pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false — exit 0.
- backend: pnpm.cmd --filter @harness/backend exec jest --runInBand --runTestsByPath src/modules/production/services/repair.service.spec.ts — 15/15 통과.
- frontend: node --test apps/frontend/src/app/(authenticated)/production/repair/repair-columns.structure.test.mjs — 2/2 통과.
- git diff --check -- 수리 page.tsx — 통과.
- HTTP /production/repair — 200. Playwright 최초 goto 60초 timeout, 재시도 페이지 로드 후 /login 이동.
- 기존 브라우저 인증을 별도 repair-check 세션에 복원하여 재시도했으나 /api/auth/me 401로 /login 이동. 화면 카드 제거 렌더/실제 등록·수정·완료 UI 검증은 미완료.
- 별도 로컬 프린트 에이전트 127.0.0.1:37111/health ERR_CONNECTION_REFUSED 관측. 변경하지 않음.
- oracle-db connector --site JSHANES SELECT 3건(수리 상태/날짜 시각 성분 집계, 공통코드, 수리 테이블 트리거) 모두 DPY-6005 연결 timed out. 실제 운영 데이터 상태 확인 못함.
- 기존 단위테스트 통과는 위 업무 단절 부재를 증명하지 않음.

## 중단 사유

- 카드 소스 수정 및 코드 점검 완료. 인증 401/DB 연결 실패로 실제 종단 검증은 미완료. 프로세스 결함은 점검 결과로 남김.

## 다음 작업자가 바로 할 일

1. 인증/DB 접근 복구 후 현재 날짜 저장값과 트리거, 공통코드부터 대조.
2. 날짜 키 정규화, 상태 필터, 빈 usedParts 저장부터 보완하고 회귀 검증.
3. 수리 시작/완료 조건 및 재검사/공정복귀/폐기/사용부품 수불 규칙을 연결하고, 테스트 데이터 범위 확정 후 종단 검증.

## 주의사항

- 업무 DB 생성/수정/삭제 없음. 잔여 테스트 데이터 없음.
- 인증 전달용 임시 파일은 로드 직후 삭제했고 토큰은 출력하지 않음. 기존 브라우저/서버/포트 변경 없음.
- 커밋/푸시는 요청되지 않아 수행하지 않음. 타 작업 dirty 파일은 보존.