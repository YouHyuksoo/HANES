---
menuCode: PROD_ORDER
audience: operator
title: 작업지시 관리 — 운영 가이드
summary: 작업지시(JOB_ORDERS)의 전체 컬럼·DB 매핑, 상태 전이 로직, 채번 규칙, ITEM/OPERATION 분기, BOM 자동전개, 멀티테넌시와 트러블슈팅
tags: [생산, 작업지시, 운영, 상태전이, BOM, 채번, OPERATION, 라우팅]
keywords: [JOB_ORDERS, 작업지시, WO, ORDER_NO, 상태전이, WAITING, RUNNING, HOLD, DONE, CANCELED, 채번, nextJobOrderNo, BOM전개, PARENT_ORDER_NO, ROOT_ORDER_NO, ROUTING_CODE, PROD_RESULTS, 멀티테넌시, 트러블슈팅, ORDER_KIND, ROUTING_SEQ, 사전발행, ERP_SYNC_YN]
related: [PROD_RESULT, MST_PART, MST_ROUTING]
---

# 작업지시 관리 — 운영 가이드

## 시스템 목적·역할
완제품·반제품의 생산 명령을 발행·관리하는 화면으로, **생산실적·검사·출하·재고의 출발점**입니다. 작업지시 1건은 자연키 `ORDER_NO`를 PK로 하며, 품목(`ITEM_CODE`)·라우팅(`ROUTING_CODE`)을 참조하고 자기참조(`PARENT_ORDER_NO`)로 완제품-반제품 계층을 형성합니다. 상태는 전용 API(시작/홀딩/홀딩해제/완료/취소)로만 전이되며, 직접 변경은 차단됩니다.

`ORDER_KIND` 컬럼으로 두 가지 유형이 존재합니다.
- **ITEM**: 품목 단위 작업지시 (완제품·반제품). 사용자가 생성하는 작업지시.
- **OPERATION**: 라우팅 공정 단위 작업지시. ITEM 작업지시 저장 시 라우팅 공정 수만큼 자동 생성.

> API 기본 경로: `/production/job-orders`. 메뉴코드 `PROD_ORDER`, 경로 `/production/order`.

## 데이터 구조
```
ITEM_MASTERS(품목) ──ITEM_CODE──▶ JOB_ORDERS ◀──PARENT_ORDER_NO── (반제품/공정 자식 작업지시)
        │                            │  │
        │                            │  └──ROOT_ORDER_NO── 동시생성 그룹 최상위
ROUTING_GROUPS ──ROUTING_CODE────────┘  │
ROUTING_PROCESS ──ROUTING_CODE/SEQ──────┤  (OPERATION 자식 생성 시 참조)
PROD_PLANS ──PLAN_NO────────────────────┤
                                        │
                            PROD_RESULTS(실적) ◀──ORDER_NO── (실적 집계: GOOD_QTY/DEFECT_QTY)
                            FG_LABELS(완제품 바코드) ◀──ORDER_NO── (PRE_ISSUE 사전발행)
```

완제품 1건 저장 시 자동 생성 구조:
```
완제품 ITEM 작업지시 (ORDER_KIND='ITEM')
  ├─ OPERATION 작업지시들 (ORDER_KIND='OPERATION', ROUTING_SEQ=1/2/3...)
  └─ 반제품 ITEM 작업지시 (ORDER_KIND='ITEM', PARENT_ORDER_NO=완제품)
        └─ 반제품의 OPERATION 작업지시들
```

- BOM 전개: `BOM_MASTERS`(parentItemCode → childItemCode, useYn='Y')에서 `SEMI_PRODUCT`만 골라 자식 작업지시를 재귀 생성.
- OPERATION 자동 생성: `ROUTING_PROCESS`(routingCode, jobOrderYn='Y')의 공정 수만큼 생성.
- 실적 집계: 완료 시 `PROD_RESULTS`의 양품/불량 합계(CANCELED 제외)를 `GOOD_QTY`/`DEFECT_QTY`로 반영.

> 주의(코드 불일치): 화면 그리드 미리보기 SQL에는 `PROD_ORDERS`로 표기되어 있으나, **실제 엔티티/테이블명은 `JOB_ORDERS`**입니다(엔티티 `@Entity({ name: 'JOB_ORDERS' })`). 운영 기준은 `JOB_ORDERS`.

---

## ① 작업지시 — JOB_ORDERS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 작업지시번호 | `ORDER_NO` | PK(자연키, varchar2 50). 미입력 시 서버 자동 채번. 변경 불가. |
| 상위 작업지시 | `PARENT_ORDER_NO` | 부모 작업지시 `ORDER_NO`(self FK). 반제품/OPERATION 자식은 부모 ORDER_NO를 가짐. 최상위는 NULL. |
| 동시생성 루트 | `ROOT_ORDER_NO` | BOM/OPERATION 자동전개 그룹의 최상위 ORDER_NO. 최상위 자신은 NULL. |
| 구분 | `ORDER_KIND` | varchar2 20. `ITEM`=품목 단위 작업지시(완제품·반제품), `OPERATION`=라우팅 공정별 세부 작업지시. 생성 시 서버가 자동 결정(사용자 입력 아님). |
| 공정 순서 | `ROUTING_SEQ` | int(nullable). OPERATION 타입만 값 있음. 라우팅 공정 번호(ROUTING_PROCESS.SEQ). ITEM 타입은 NULL. |
| 생산계획번호 | `PLAN_NO` | 연결된 `PROD_PLANS.PLAN_NO`(선택). 취소 시 해당 계획의 `ORDER_QTY`를 차감. |
| 품목코드 | `ITEM_CODE` | `ITEM_MASTERS.ITEM_CODE` 참조(필수). 생성 시 품목 존재·테넌트 일치 검증. |
| 라인 | `LINE_CODE` | 생산 라인(선택). |
| 라우팅 코드 | `ROUTING_CODE` | 품목 기반 자동 조회(`ROUTING_GROUPS`, useYn='Y'). **라우팅이 없으면 작업지시 생성 불가**(400 오류). |
| 공정 | `PROCESS_CODE` | 대표 공정. 미지정 시 라우팅 첫 SEQ에서 자동 상속. 공정 변경 시 설비 초기화. |
| 설비 | `EQUIP_CODE` | 작업 설비(선택). 생성 시 보통 NULL, 이후 배정. |
| 계획수량 | `PLAN_QTY` | int. 필수, 1 이상. 자식(반제품)은 `ceil(부모수량 × BOM 소요량)`. OPERATION 자식은 부모와 동일. |
| 양품수량 | `GOOD_QTY` | int(기본 0). 실적 집계값(PROD_RESULTS 합계). 완료 시 확정 갱신. |
| 불량수량 | `DEFECT_QTY` | int(기본 0). 실적 집계값. |
| 계획일 | `PLAN_DATE` | date(nullable). 목록 조회 기본 필터. NULL 건은 범위 필터와 무관하게 항상 노출. |
| 시작시간 | `START_AT` | timestamp. start 시 최초 1회 기록. |
| 종료시간 | `END_AT` | timestamp. complete/cancel 시 기록. |
| 우선순위 | `PRIORITY` | int(기본 5). 1(최상)~10(최하). 목록은 PRIORITY ASC, PLAN_DATE ASC, CREATED_AT DESC 정렬. |
| 상태 | `STATUS` | varchar2 20(기본 WAITING). 공통코드 `JOB_ORDER_STATUS`. 값: WAITING/RUNNING/HOLD/DONE/CANCELED. |
| 고객PO번호 | `CUST_PO_NO` | 대응 고객 PO(선택). |
| 비고 | `REMARK` | varchar2 500. HOLD 시 `[HOLD] 이전상태:{state}` 접두사를 주입해 복귀 상태를 보존. OPERATION 자식은 `[공정작업] {부모ORDER_NO} {seq}-{공정명}`. |
| ERP 동기화 | `ERP_SYNC_YN` | 'Y'/'N'(기본 N). 완료(DONE) 건 중 'N'을 ERP 미동기화 목록으로 노출. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | 회사/사업장 스코프. 표준값 `COMPANY='40'`, `PLANT_CD='1000'`. 품목·라우팅과 테넌트 일치 검증. |
| 등록/수정자 | `CREATED_BY`, `UPDATED_BY` | 감사 컬럼. |
| 등록/수정시각 | `CREATED_AT`, `UPDATED_AT` | timestamp(DEFAULT SYSTIMESTAMP). |

---

## 채번 규칙
- 채번: `nextJobOrderNo()` → 채널 `JOB_ORDER`(Oracle SEQUENCE 기반, 트랜잭션 내 `QueryRunner` 공유).
- 포맷: `W + YYMMDD + - + 3자리 일별 시퀀스`. 예: `W260519-001`. 일별 0시 리셋(DBMS_SCHEDULER).
- 단일 출처: `docs/standards/numbering-rules.md`.

## 버튼·API·상태 전이

전용 API로만 상태 전이. `PUT /:id/status`(직접 변경)는 항상 거부됩니다(상태 점프 우회 방지).

| 버튼/액션 | API | 허용 조건 | 결과 상태 / DB 영향 |
|------|------|------|------|
| 시작 | `POST /:id/start` | WAITING | RUNNING. START_AT 최초 기록. `FG_BARCODE_ISSUE_TIMING=PRE_ISSUE`면 계획수량만큼 FG_LABELS 발행. |
| 홀딩 | `POST /:id/hold` | WAITING/RUNNING | HOLD. REMARK에 `[HOLD] 이전상태:{state}` 주입(복귀용). 실적등록·출하 차단. |
| 홀딩해제 | `POST /:id/hold-release` | HOLD | 이전 상태 복귀. REMARK에서 이전 상태 파싱해 복귀, 접두사 제거. |
| 완료 | `POST /:id/complete` | RUNNING | DONE. PROD_RESULTS 합계로 GOOD_QTY/DEFECT_QTY 확정, END_AT 기록(트랜잭션). 잔량 무관 종료. |
| 취소 | `POST /:id/cancel` | WAITING/HOLD | CANCELED. 실적 1건이라도 있으면 거부. PLAN_NO 연결 시 계획 ORDER_QTY 차감, END_AT 기록. |
| 생성 | `POST /` | — | JOB_ORDERS 저장 → createRoutingOperationOrders → createChildOrdersRecursive(BOM 전개). 라우팅 없으면 400. |
| 수정 | `PUT /:id` | WAITING/RUNNING/HOLD | DONE/CANCELED 거부. STATUS 직접 변경 거부. itemCode 변경 시 ROUTING_CODE 재조회. |
| 삭제 | `DELETE /:id` | WAITING/HOLD/DONE/CANCELED | RUNNING 거부(hard delete). |
| 출력 | 화면 전용 | 선택된 행 있음 | `GET /:id` + `GET /master/boms/parent/:itemCode`. 화면에서 A4 렌더. |

## ITEM/OPERATION 자동 생성 로직

**완제품 ITEM 작업지시 생성 시 순서:**

1. 라우팅 코드 조회 (`ROUTING_GROUPS`, useYn='Y'). 없으면 400 즉시 반환.
2. 품목 작업지시(ITEM) 저장 (`ORDER_KIND='ITEM'`, `ROUTING_SEQ=NULL`).
3. **`createRoutingOperationOrders`**: `ROUTING_PROCESS`(jobOrderYn='Y') 공정별로 OPERATION 작업지시 생성.
   - `ORDER_KIND='OPERATION'`, `ROUTING_SEQ=process.seq`, `REMARK='[공정작업] {부모} {seq}-{공정명}'`.
4. **`createChildOrdersRecursive`**: BOM 전개로 반제품(SEMI_PRODUCT) 자식 ITEM 작업지시 재귀 생성.
   - 자식 PLAN_QTY = `ceil(부모 PLAN_QTY × BOM.QTY_PER)`.
   - 각 반제품 자식에 대해 다시 3번(OPERATION 생성), 4번(재귀) 반복.
   - BOM 순환참조(조상 경로 추적)·깊이 50 백스톱으로 무한루프 차단.

> `autoCreateChildren` DTO 필드는 현재 프론트에서 전송하지 않으며, BOM/OPERATION 자동전개는 항상 실행됩니다.

## 상태 코드 (공통코드: JOB_ORDER_STATUS)

| 코드 | 한글 | 의미 |
|------|------|------|
| WAITING | 대기 | 생성 직후. 실적 등록 전. |
| RUNNING | 진행중 | 시작 후. 실적 등록 중. |
| HOLD | 홀딩 | 임시 중단. 실적·출하 차단. |
| DONE | 완료 | 종료. 실적 확정. 변경 불가. |
| CANCELED | 취소 | 폐기. 실적 없어야 전환 가능. |

## 사전 설정 (마스터·공통코드)
- 공통코드: `JOB_ORDER_STATUS`(상태 배지/필터).
- 마스터 선행: 품목마스터(`ITEM_MASTERS`), 라우팅(`ROUTING_GROUPS`/`ROUTING_PROCESS`, jobOrderYn='Y'), BOM(`BOM_MASTERS`), 설비·라인.
- **라우팅 필수**: 라우팅이 없는 품목은 작업지시 생성 불가.
- 시스템 설정: `FG_BARCODE_ISSUE_TIMING`(`ON_INSPECT` 기본 / `PRE_ISSUE` 시 시작 시 바코드 일괄 발행).

## 운영 절차
1. 품목·라우팅(jobOrderYn='Y' 공정 포함)·BOM을 먼저 등록(라우팅 없으면 생성 불가).
2. 작업지시 생성(품목·계획수량·계획일 필수). 완제품은 BOM·공정 자동전개로 하위 작업지시 동시 생성.
3. 시작 → (생산실적 등록) → 완료 순으로 진행. 필요 시 홀딩/해제.
4. 완료 건은 ERP 미동기화 목록(`GET /erp/unsynced`)에서 확인 후 동기화 처리(`POST /erp/mark-synced`).

## 권한
생산 관리자(생성/수정/삭제·상태전이). 일반 사용자는 조회. (멀티테넌시 스코프 내에서만 조회/조작)

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 생성 시 400 "라우팅이 지정되지 않았습니다" | 품목에 라우팅 미등록 또는 useYn='N' | ROUTING_GROUPS에 해당 품목 라우팅 등록, useYn='Y' 확인. |
| 시작 버튼 비활성 | 상태가 WAITING이 아님 | WAITING 건만 시작 가능. 홀딩 건은 홀딩해제 후 시작. |
| 완료 안 됨(400) | 상태가 RUNNING이 아님 | 시작(RUNNING) 후 완료. |
| 취소 거부(400) | 실적이 존재 | 실적 삭제 후 취소, 또는 완료로 종료. |
| 수정 거부(400) | DONE/CANCELED 상태이거나 status 직접 변경 시도 | 완료/취소 건은 수정 불가. 상태는 전용 API로만. |
| 삭제 거부(400) | RUNNING 상태 | 진행중은 삭제 불가(완료/취소 후 처리). |
| 공정별 자식 작업지시 미생성 | 라우팅 공정의 jobOrderYn='N' | ROUTING_PROCESS 테이블에서 jobOrderYn='Y'인 공정이 있어야 OPERATION 자식이 생성됨. |
| 반제품 자식 작업지시 미생성 | BOM 자식이 SEMI_PRODUCT 아님 또는 BOM 미등록 | BOM_MASTERS.childItemCode의 itemType 확인, SEMI_PRODUCT이어야 생성됨. |
| 라우팅/공정 자동 안 들어옴 | 품목 라우팅 미등록(useYn='Y' 없음) | 라우팅 그룹 등록 또는 공정 직접 지정. |
| 설비 목록 비어 있음 | 선택 공정에 매핑된 설비 없음 | 설비 마스터에서 해당 공정 설비 등록. |
| 중복 번호(409) | 동일 ORDER_NO 존재 | 자동 채번 사용(직접 입력 지양). |
| 목록에 안 보임 | 계획일 필터 범위 밖 | 필터 확대(NULL 계획일은 항상 노출). |
| 출력 모달에 자재 없음 | BOM에 RAW_MATERIAL 품목 없음 | BOM_MASTERS에 itemType='RAW_MATERIAL' 자식 등록. 반제품·소모품은 출력에서 제외됨. |

## 데이터·연계
- 테이블: `JOB_ORDERS`(+ 자기참조 PARENT_ORDER_NO/ROOT_ORDER_NO)
- 참조: `ITEM_MASTERS`(ITEM_CODE), `ROUTING_GROUPS`/`ROUTING_PROCESS`(ROUTING_CODE), `BOM_MASTERS`(전개), `PROD_PLANS`(PLAN_NO)
- 연계: `PROD_RESULTS`(실적 집계 → GOOD_QTY/DEFECT_QTY), `FG_LABELS`(PRE_ISSUE 사전발행), 출하/검사(HOLD 시 차단), ERP 동기화
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`
