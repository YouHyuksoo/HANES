# THN Material IQC and Process Sample Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하네스 THN 대응을 위해 자재 입하-IQC-입고 흐름, 유수명 자재 관리, 공정샘플검사 설정/실적 입력 요구사항을 운영 가능한 순서로 반영한다.

**Architecture:** 자재 흐름은 `입하 및 시리얼 채번/라벨발행 -> IQC 판정 -> 입고`를 기준으로 고정한다. IQC는 자재 시리얼별이 아니라 `arrivalNo + itemCode` 입하단위로 판정하고, 검사대상품은 성적서 파일 업로드가 있어야 입고 가능하게 막는다. 공정샘플검사는 기존 자주검사와 개념을 분리하되, 생산실적 화면에서는 하네스 요청 용어와 초/중/종물 선택 설정을 우선 반영한다.

**Tech Stack:** NestJS, TypeORM, Oracle, Next.js/React, Jest, `pnpm --filter @harness/backend`, `pnpm --filter @harness/frontend`.

---

## 요구사항 판정

### 이미 반영 또는 일부 반영

- 입하 시 시리얼 채번과 라벨 미리보기: `POST /material/arrivals/po-line`에서 `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `MAT_ARRIVALS` 생성.
- IQC 검사 단위: 프론트 `useIqcData`와 백엔드 `POST /material/iqc-history/arrival`가 `arrivalNo + itemCode` 단위로 동작.
- 검사성적서 파일 업로드 API: `POST /material/iqc-history/:inspectDate/:seq/upload-cert` 존재.
- 수동 인터페이스가 아닌 PO 라인 기반 수동 입하 화면: `/material/arrival`에 존재.
- `자주검사` 용어 일부 변경 작업은 이전 변경 이력에 있으나, 개념 분리 여부는 재확인 필요.

### 미반영 또는 보완 필요

- 검사대상품은 성적서 파일 없으면 입고 불가.
- 무검사품은 성적서 없이 입고 가능하되, 필요 시 IQC 화면에서 임의검사 가능.
- IQC 중간저장 필요. 검사 실적 입력을 한번에 또는 나눠서 할 수 있어야 함.
- IQC 검사에 사용한 샘플 시리얼을 기록해야 함.
- 유수명 자재의 유효기간 초과 관리 강화.
- 초/중/종물 검사 중 어떤 검사를 사용할지 사용자 설정 필요.
- 생산실적 입력 화면의 검사 실적 보완 및 공정샘플검사 용어/흐름 정리.
- THN 품목은 아직 자재품번이 확정되지 않았으므로 스케줄러 동기화와 수동 인터페이스 버튼 비활성화 필요.

---

## 파일 구조

- Modify: `apps/backend/src/modules/material/services/arrival.service.ts`
  - 입하 창고 타입 검증, 입하 데이터 생성 정책.
- Modify: `apps/backend/src/modules/material/services/iqc-history.service.ts`
  - 입하단위 IQC 상태 동기화, 성적서 필수 검증, 중간저장 추가 후보.
- Modify: `apps/backend/src/modules/material/services/receiving.service.ts`
  - 입고 가능 조건에 IQC 성적서 필수 여부 반영.
- Modify or Create: `apps/backend/src/modules/material/entities` or existing entities
  - 필요 시 IQC 임시저장/샘플 시리얼 기록 테이블 추가.
- Modify: `apps/frontend/src/app/(authenticated)/material/arrival/**`
  - THN 수동 입하 흐름, 창고 선택 제한, 인터페이스 버튼 비활성화.
- Modify: `apps/frontend/src/app/(authenticated)/material/iqc/page.tsx`
- Modify: `apps/frontend/src/hooks/material/useIqcData.ts`
- Modify: `apps/frontend/src/components/material/IqcModal.tsx`
  - 입하단위 검사, 성적서 필수, 중간저장, 샘플 시리얼 입력.
- Modify: `apps/frontend/src/app/(authenticated)/production/input-kiosk/**`
  - 공정샘플검사 용어/팝업/실적입력 보완.
- Modify: `apps/backend/src/modules/production/**`
  - 초/중/종물 사용 설정과 검사 실적 저장 정책.
- Test: `apps/backend/src/modules/material/services/*.spec.ts`
- Test: 관련 frontend typecheck 및 필요 시 component test.

---

## Task 1: 현재 입하-IQC-입고 흐름 안정화

- [x] 입하 창고는 `RAW` 또는 `RM` 창고만 허용하는 backend test를 추가한다.
- [x] `arrival.service.ts`에서 `receivePoLine` 창고 타입을 검증한다.
- [x] `/material/arrival`의 창고 선택을 `useWarehouseOptions('RAW')`로 제한한다.
- [x] `createArrivalResult`가 `MAT_LOTS.IQC_STATUS`와 `MAT_ARRIVALS.IQC_STATUS`를 같이 갱신하는 테스트를 유지한다.
- [x] IQC 취소도 `MAT_LOTS`, `MAT_ARRIVALS`를 같이 PENDING 복원하는 테스트를 유지한다.
- [x] 입고 시 입하창고 재고 차감을 `matUid` 기준으로 수행한다.
- [x] PO 허용오차 검사 수동 SQL의 사업장 컬럼을 실제 DB 컬럼 `PLANT_CD` 기준으로 수정한다.
- [x] 실행:
  - `pnpm --filter @harness/backend test -- --runInBand --testPathPatterns='arrival.service.spec.ts|iqc-history.service.spec.ts|receiving.service.spec.ts'`
  - `pnpm --filter @harness/backend exec tsc --noEmit --pretty false`
  - `pnpm --filter @harness/frontend exec tsc --noEmit --pretty false`

## Task 2: 검사대상품 성적서 필수 입고 게이트

- [x] 품목의 IQC 대상 여부 기준을 `ITEM_MASTERS.IQC_FLAG`/`PartMaster.iqcYn`으로 적용한다.
- [x] `receiving.service.ts`에서 입고 대상 LOT의 품목이 검사대상품이면 `IQC_LOGS.certFilePath`가 있는 DONE/PASS 이력을 요구하는 실패 테스트를 작성한다.
- [x] 무검사품은 성적서 없이 입고 가능하도록 현재 정책을 유지한다.
- [x] `ReceivingService.findReceivable` 응답에 `certRequired`, `certUploaded`, `receivingBlockedReason`을 추가한다.
- [x] 프론트 `/material/receive` 테이블에서 성적서 미첨부 검사대상품을 선택 불가로 만들고 사유를 표시한다.

### Task 1-2 실제 검증

- 테스트 입하: `R26053000001`, `VH1-RM260530-00001`, `LDWX00017NA`.
- 성적서 미첨부 상태에서 `POST /api/v1/material/receiving`은 `400 검사성적서 업로드 후 입고`로 차단됨.
- `POST /api/v1/material/iqc-history/2026-05-30T04:19:33.175Z/1/upload-cert` 후 같은 LOT 입고 성공.
- 입고 후 `/material/receiving/receivable`에서 해당 LOT 제거 확인.
- DB 확인: `MAT_RECEIVINGS.RCV20260530-0001`, `STOCK_TRANSACTIONS.TX20260530-00002`, `MAT_STOCKS`의 `WH-MAT-A/LDWX00017NA/VH1-RM260530-00001` 재고 `QTY=1`.

## Task 3: IQC 중간저장과 샘플 시리얼 기록

- [ ] 입하단위 IQC 임시저장 모델을 결정한다. 권장: `IQC_LOGS.status='DRAFT'`를 사용하거나 별도 `IQC_DRAFTS` 테이블 추가.
- [ ] 검사 샘플 시리얼 목록 저장 위치를 결정한다. 권장: `details` JSON에 `sampleMatUids`를 넣되 조회/감사를 위해 별도 컬럼 또는 테이블 필요 여부 검토.
- [ ] `IqcHistoryService.saveDraftArrivalResult` 또는 기존 endpoint 확장 테스트를 작성한다.
- [ ] `IqcModal`에서 `임시저장`, `최종판정` 버튼을 분리한다.
- [ ] 샘플 시리얼 선택/입력 UI를 추가한다. 기본은 해당 입하번호의 `MAT_LOTS` 목록에서 선택.
- [ ] 최종 PASS/FAIL 전환 시에만 `MAT_LOTS/MAT_ARRIVALS.IQC_STATUS`를 변경한다.

## Task 4: 검사품/무검사품 모두 IQC 화면 노출

- [ ] `pending-arrivals`가 PENDING 입하 전체를 반환하는 현재 정책을 유지하되, 품목 검사정책 정보를 같이 보강한다.
- [ ] 응답에 `iqcRequired`, `certificateRequired`, `policyName`을 추가한다.
- [ ] 프론트 IQC 목록에서 검사대상/무검사/임의검사를 구분 표시한다.
- [ ] 무검사품은 성적서 필수가 아니지만 사용자가 검사 실적을 입력할 수 있게 유지한다.

## Task 5: 유수명 자재와 유효기간 초과 관리

- [ ] 현재 `MAT_LOTS.expireDate`, `manufactureDate`, shelf-life 재검사 서비스를 점검한다.
- [ ] 유효기간 초과 LOT이 생산 투입/입고/출고 가능 상태로 남는지 DB/API로 확인한다.
- [ ] 만료 상태 계산 규칙을 정한다: `NORMAL`, `EXPIRED`, `RETEST_REQUIRED`, `BLOCKED`.
- [ ] 만료 LOT 차단 지점 테스트를 작성한다. 최소: 출고/투입 전 차단, 재검사 후 복원.
- [ ] UI에 만료/임박/재검사 필요 배지를 추가한다.

## Task 6: THN 스케줄러 동기화와 수동 인터페이스 버튼 비활성화

- [ ] THN 품목 동기화 스케줄러/수동 인터페이스 버튼 위치를 찾는다.
- [ ] 스케줄러가 THN 품목을 가져오지 않도록 feature flag 또는 disabled 상태로 분리한다.
- [ ] 수동 인터페이스 버튼은 숨김보다 disabled + tooltip 사유 표시를 우선 적용한다.
- [ ] 버튼 클릭 API가 있다면 backend에서도 차단한다.

## Task 7: 공정샘플검사 설정과 생산실적 입력 보완

- [ ] 기존 “자주검사”와 “초/중/종물 검사” 코드/용어를 분리해서 목록화한다.
- [ ] `/production/input-kiosk`에서 하네스 요청 범위의 표시명은 `공정샘플검사`로 정리한다.
- [ ] 초/중/종물 사용 여부 설정 모델을 추가한다. 예: `FIRST/MIDDLE/LAST` 개별 boolean.
- [ ] 라우팅 또는 품목/공정별 설정 위치를 결정한다.
- [ ] 실적 입력 시 설정된 검사만 요구되도록 backend validation과 frontend UI를 수정한다.
- [ ] 팝업 폭은 현장 요청 이미지 기준으로 가로 확장한다.

---

## 우선순위

1. Task 1: 현재 운영 흐름 버그 안정화.
2. Task 2: 검사대상품 성적서 없으면 입고 불가.
3. Task 3: IQC 중간저장과 샘플 시리얼 기록.
4. Task 4: 검사품/무검사품 정책 표시.
5. Task 5: 유수명/유효기간 초과 관리.
6. Task 6: THN 동기화/인터페이스 비활성화.
7. Task 7: 공정샘플검사 설정/실적 입력.

---

## 검증 기준

- 입하 등록 즉시 `MAT_LOTS`, `MAT_ARRIVALS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`가 같은 `arrivalNo`, `arrivalSeq`, `matUid`로 연결된다.
- IQC PASS 후 같은 입하번호가 PENDING 목록에서 빠지고 입고 가능 목록에 나타난다.
- 검사대상품은 PASS라도 성적서 없으면 입고 불가다.
- 무검사품은 성적서 없이 입고 가능하지만 IQC 화면에서 임의 검사 실적 입력도 가능하다.
- IQC DRAFT는 입고 가능 상태로 보이면 안 된다.
- 초/중/종물 설정에 따라 생산실적 입력에서 요구되는 검사 항목이 달라진다.
