# 미완료 작업 기록: 작업지시 묶음 출고요청

- 작성시각: 2026-10-23 16:10 KST
- 작성자: claude
- 작업 범위: `/material/request` 출고요청관리, 현장 개선요청 22번 "작업지시 묶음 출고요청"
- 현재 상태: 검증대기

## 완료한 것

- 같은 공정 작업지시 2건 이상을 품목 합산 출고요청 1건으로 묶는 기능. 작업지시별 수량은 신규 테이블 `MAT_ISSUE_REQUEST_ITEM_ORDERS`에 둔다(JSHANES DDL 적용 완료, ERD 재생성).
- 산출: 작업지시별 (BOM 소요 - 기출고)를 품목 단위로 합산한다. 현장재고는 품목당 한 번만, 계획일 빠른 작업지시부터 덮는다.
- 등록: 사용자가 합계를 고치면 서버가 계획일 빠른 순으로 다시 나눈다. 직접 추가한 품목은 계획일이 가장 빠른 작업지시에 붙는다. 같은 공정이 아니면 서버가 거절한다. 중복 가드는 1:1 요청과 묶음 요청을 교차로 본다.
- 요청 기반 출고(`issueFromRequest`): LOT 수량을 작업지시별로 나눠 `MAT_ISSUES.ORDER_NO`를 작업지시마다 남긴다. LOT 하나가 두 작업지시에 걸치면 출고 행이 2개 생긴다.
- 스캔 출고 배분(`allocateIssuedQtyInTx`): 작업지시별 행에도 가산한다. PDA처럼 작업지시를 찍은 스캔은 그 작업지시를 먼저 채운다.
- 불변식 `TXN-MAT-004`: 품목 수량 = 작업지시별 수량 합계.
- 화면: 좌측 체크박스와 [묶음 출고요청] 버튼. 다른 공정 작업지시는 체크할 수 없다. 내역, 최근목록, 상세 모달, 창고 출고 모달, 출고 탭에 묶인 작업지시를 표시한다.

## 미완료 / 남은 것

- 묶음 요청의 승인 → 실출고(LOT 스캔)를 실화면에서 돌려보지 않았다. 특히 LOT 하나가 두 작업지시에 걸쳐 같은 matUid 로 `createInTx` 행 2개가 생기는 경우(LOT 잔량, DEPLETED 판정)는 mock 스펙으로만 검증했다.
- 커밋·푸시는 했다(`feat(material): 작업지시 묶음 출고요청` 커밋). hswbs 배포는 하지 않았다.
- 개선요청 22번은 DONE 으로 바꾸면 안 된다. 커밋 해시, 테스트 근거, 배포 SHA 가 아직 없다.
- 작업지시를 찍지 않은 웹 바코드 스캔 출고는 `MAT_ISSUES.ORDER_NO`가 NULL 로 남는다. 1:1 요청도 같은 기존 동작이다.

## 변경 파일

- `apps/backend/src/migrations/2026-10-23_mat_issue_request_item_orders.sql`: 신규 테이블 DDL(멱등)
- `apps/backend/src/entities/mat-issue-request-item-order.entity.ts`: 신규 엔티티
- `apps/backend/src/modules/material/services/issue-request-order-split.ts`(+spec): 산출·배분 순수 함수
- `apps/backend/src/modules/material/services/issue-request.service.ts`(+spec): 묶음 산출, 생성, 교차 중복 가드, 조회 응답(orders, bundleOrderNos), 출고 작업지시 분할
- `apps/backend/src/modules/material/services/issue-request-allocation.service.ts`(+spec): `allocateToItemOrdersInTx`, 스캔 우선순위
- `apps/backend/src/modules/material/services/mat-issue.service.ts`: 출고 행 단위 orderNo
- `apps/backend/src/modules/material/{dto/issue-request.dto.ts,dto/mat-issue.dto.ts,controllers/issue-request.controller.ts,issue/issue.module.ts}`
- `apps/backend/src/modules/master/validation/rules/txn-invariant.rules.ts`: TXN-MAT-004
- `apps/frontend/src/components/material/**`, `hooks/material/{useIssueRequestData,useIssueRequests}.ts`, `app/(authenticated)/material/request/page.tsx`
- `apps/frontend/src/locales/{ko,en,zh,vi}.json`: `material.request.bundle*` 7키
- `docs/database/schema-erd.md`: 재생성

## 검증 상태

- 실행함: backend jest material+validation 33 suites 617 tests PASS. backend/frontend tsc 0.
- 실행함: frontend 구조테스트에서 새 실패 0. 기존 실패 7건은 HEAD 에도 검사 대상 문자열이 없는 낡은 테스트다.
- 실행함: localhost:3002 에서 같은 공정 잠금을 확인했다(MASSY 를 고르면 GCRMP 비활성). GCRMP 2건 묶음 산출과 등록(MR2610230115)이 됐고 두 작업지시 내역에 모두 보였다.
- 실행함: 1:1 교차 중복 요청이 400 으로 막혔다. DB 의 작업지시별 행 8건을 확인했고 TXN-MAT-004 위반은 0건이었다. 테스트 요청은 DB 에서 삭제했다(헤더/품목/작업지시별 0/0/0).
- 실행 못함: 묶음 요청 실출고 화면 흐름. 테스트 출고를 하면 실재고가 움직여서 하지 않았다.

## 중단 사유

- 실출고 검증은 실재고를 움직인다. 배포는 사용자 지시가 필요하다.

## 다음 작업자가 바로 할 일

1. 묶음 요청 1건을 만들고 승인한 뒤, LOT 하나로 두 작업지시에 걸치게 출고한다. `MAT_ISSUES` 2행(같은 MAT_UID, ORDER_NO 다름), LOT 잔량, `MAT_ISSUE_REQUEST_ITEM_ORDERS.ISSUED_QTY`, TXN-MAT-004 를 확인한다.
2. 사용자 지시가 있으면 hswbs 에 배포하고, 개선요청 22번에 커밋 해시·테스트 근거·배포 SHA 를 채운다.

## 주의사항

- `mat-issue-request.entity.ts`, `mat-issue-request-item.entity.ts`에 다른 세션의 미커밋 PK 변경이 있다. 이 작업에서는 손대지 않았다.
- 묶음 판별은 `MAT_ISSUE_REQUEST_ITEM_ORDERS` 행이 있는지로 한다. 헤더 ORDER_NO=NULL 은 수동요청도 같다.
- 요청 품목 `ISSUED_QTY`를 올리는 새 경로를 만들면 `allocateToItemOrdersInTx`도 같이 불러야 한다.

## 재개 절차

1. `git status --short`로 위 변경 파일이 남아 있는지 확인한다.
2. `SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME='MAT_ISSUE_REQUEST_ITEM_ORDERS'`(JSHANES)가 1인지 확인한다.
3. 위 "다음 작업자가 바로 할 일" 1번부터 진행한다.
