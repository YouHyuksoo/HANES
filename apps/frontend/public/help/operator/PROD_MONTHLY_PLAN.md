---
menuCode: PROD_MONTHLY_PLAN
audience: operator
title: 제품생산계획 — 운영 가이드
summary: PROD_PLANS 테이블 전체 컬럼·DB 매핑, 상태 전이/작업지시 발행 로직, 자동편성(MPS)·엑셀업로드 절차, 채번·권한·트러블슈팅·멀티테넌시
tags: [생산, 생산계획, MPS, 작업지시, 운영, 설정]
keywords: [PROD_PLANS, PLAN_NO, 제품생산계획, 월간생산계획, MPS, 채번, PP-YYYYMM-NNN, ORDER_QTY, PLAN_QTY, 발행률, 작업지시발행, issue-job-order, DRAFT, CONFIRMED, CLOSED, 확정, 확정취소, 마감, 자동편성, auto-generate, 엑셀업로드, bulk, autoCreateChildren, BOM전개, COMPANY, PLANT_CD, 트러블슈팅]
related: [MST_PART, PROD_JOB_ORDER]
---

# 제품생산계획 — 운영 가이드

## 시스템 목적·역할
완제품·반제품의 **월(YYYY-MM) 단위 생산계획**을 관리하는 마스터-트랜잭션 경계 화면입니다. 계획(`PROD_PLANS`)을 **확정(CONFIRMED)**한 뒤 **작업지시(`JOB_ORDERS`)를 발행**해 실제 생산 흐름으로 넘깁니다. 발행 시 계획의 발행수량(`ORDER_QTY`)이 누적 증가하며, 발행률·잔여수량이 이 값으로 산출됩니다. 자동편성(MPS)은 수주(`/shipping/customer-orders`)를 근거로 DRAFT 계획을 일괄 생성합니다.

> 메뉴/타이틀은 최근 "월간생산계획" → "제품생산계획"으로 변경되었으나, 라우트(`/production/monthly-plan`)·API(`/production/prod-plans`)·테이블(`PROD_PLANS`)·i18n 네임스페이스(`monthlyPlan.*`)는 그대로 유지됩니다.

## 데이터 구조
```
PROD_PLANS (PK: PLAN_NO = PP-YYYYMM-NNN, STATUS: DRAFT→CONFIRMED→CLOSED)
   │ ITEM_CODE (ManyToOne, nullable)
   ▼
PART_MASTERS (품목명·BOM·라우팅 참조)

작업지시 발행 시:
PROD_PLANS.ORDER_QTY += issueQty   (트랜잭션 내 원자적 증가)
   └─▶ JOB_ORDERS (status=WAITING) [+ autoCreateChildren 시 BOM 하위 SEMI_PRODUCT 재귀 생성]
```
- API 베이스: `@Controller('production/prod-plans')` → `/api/v1/production/prod-plans`
- 목록 정렬: `priority ASC, createdAt DESC`. 화면 필터는 `startDate/endDate`를 **월(앞 7자리)**로 절단해 `planMonth` 범위 비교.

---

## ① 생산계획 — PROD_PLANS (전체 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 계획번호 | `PLAN_NO` | PK. 자연키. 형식 `PP-YYYYMM-NNN`. 채번은 해당 월 prefix의 MAX+1(아래 채번 로직). 변경 불가. |
| 계획월 | `PLAN_MONTH` | `VARCHAR2(7)`, `YYYY-MM`. 인덱스 존재. 일자 컬럼 없음(월 단위 계획). DTO에서 `^\d{4}-\d{2}$` 검증. |
| 품목코드 | `ITEM_CODE` | `VARCHAR2(50)`. `PART_MASTERS.ITEM_CODE` ManyToOne(nullable). 등록 시 품목 존재 검증(없으면 404). |
| 품목유형 | `ITEM_TYPE` | `VARCHAR2(10)`. `FINISHED`/`SEMI_PRODUCT`만 허용(`@IsIn`). |
| 계획수량 | `PLAN_QTY` | `int`. 목표 수량. `@Min(1)`. 작업지시 발행 상한 기준. |
| 발행수량 | `ORDER_QTY` | `int`, default 0. 누적 발행량. 발행 시 SQL `ORDER_QTY + :issueQty`로 원자 증가(앱 메모리 합산 아님). |
| 발행률 | (계산) | 화면 계산값 `min(round(ORDER_QTY/PLAN_QTY*100),100)`. DB 컬럼 아님. |
| 고객사 | `CUSTOMER` | `VARCHAR2(50)`, nullable. 거래처(CUSTOMER) 코드. 참고/수주 대응용. |
| 라인 | `LINE_CODE` | `VARCHAR2(255)`, nullable. 기본 생산라인. 작업지시 발행 시 기본값으로 상속. |
| 우선순위 | `PRIORITY` | `int`, default 5. 1~10(`@Min(1)@Max(10)`). 목록 정렬 1순위(ASC). |
| 상태 | `STATUS` | `VARCHAR2(20)`, default `DRAFT`. 인덱스 존재. 공통코드 `PROD_PLAN_STATUS`로 배지 표시. 전이: DRAFT→CONFIRMED→CLOSED, CONFIRMED→DRAFT(취소). |
| 비고 | `REMARK` | `VARCHAR2(500)`, nullable. |
| 회사 | `COMPANY` | `VARCHAR2(50)`. 멀티테넌시 스코프. 모든 조회/수정 where에 포함. |
| 공장 | `PLANT_CD` | `VARCHAR2(50)`(엔티티 속성 `plant`). 멀티테넌시 스코프. |
| 등록자/수정자 | `CREATED_BY` / `UPDATED_BY` | `VARCHAR2(50)`, nullable. |
| 등록일시/수정일시 | `CREATED_AT` / `UPDATED_AT` | `timestamp`. `@CreateDateColumn`/`@UpdateDateColumn`. |

> 화면 그리드 컬럼 중 **품목명(partName)**은 `part.itemName`(PART_MASTERS 조인), **품목코드(partCode)**는 `part.itemCode ?? itemCode`로 표시되는 파생 컬럼이다. PROD_PLANS에는 품목명 컬럼이 없다.

---

## ② 등록/수정 폼 필드 (PlanFormPanel)

| 화면 항목 | DB/DTO | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 계획월 | `planMonth` | 신규만 입력, 수정 시 disabled(채번 기준). |
| 품목유형 | `itemType` | 신규만 선택, 수정 시 disabled. 품목 검색 모달 필터로도 사용. |
| 품목코드 | `itemCode` | PartSearchModal 선택만(readOnly). 수정 시 disabled. 필수. |
| 계획수량 | `planQty` | QtyInput. `≤0`이면 저장 버튼 비활성. |
| 우선순위 | `priority` | number, 기본 5. |
| 고객사 | `customer` | usePartnerOptions('CUSTOMER') 셀렉트. 선택. |
| 라인 | `lineCode` | `/master/prod-lines` 셀렉트. 선택. |
| 비고 | `remark` | text. 선택. |

저장 분기: 신규 `POST /production/prod-plans`, 수정 `PUT /production/prod-plans/:planNo`. 수정은 서비스에서 **DRAFT 외 차단**(BadRequest).

---

## ③ 작업지시 발행 폼 (IssueJobOrderModal → issue-job-order)

| 화면 항목 | DTO 필드 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 발행수량 | `issueQty` | `@Min(1)`. **잔여수량(planQty−orderQty) 초과 시 400**. 화면도 maxValue로 차단. 필수. |
| 계획일 | `planDate` | `@IsDateString`. JobOrder.planDate로 매핑(`parseDateStart`). 선택. |
| 라인 | `lineCode` | 미입력 시 plan.lineCode 상속. |
| 우선순위 | `priority` | 미입력 시 plan.priority 상속. |
| BOM 반제품 자동생성 | `autoCreateChildren` | `@IsBoolean`. true면 BOM 하위 SEMI_PRODUCT 작업지시 재귀 생성(아래 로직). |
| 비고 | `remark` | 미입력 시 `(planNo)에서 발행`. |

---

## 상태 전이 / 발행 로직

### 상태 전이 (서비스 가드)
| 동작 | API | 전제 상태 | 결과 | 위반 시 |
|------|------|------|------|------|
| 확정 | `POST :planNo/confirm` | DRAFT | CONFIRMED | 400 (DRAFT만) |
| 확정취소 | `POST :planNo/unconfirm` | CONFIRMED | DRAFT | 400 (CONFIRMED만) |
| 마감 | `close()` | CONFIRMED | CLOSED | 400 (CONFIRMED만) |
| 수정 | `PUT :planNo` | DRAFT | 갱신 | 400 (DRAFT만) |
| 삭제 | `DELETE :planNo` | DRAFT | 삭제 | 400 (DRAFT만) |
| 일괄확정 | `bulkConfirm` | DRAFT만 추림 | CONFIRMED | DRAFT 외는 무시(count 0) |

> 화면 노출: DRAFT 행 → 확정 버튼 + 좌측 수정/삭제 아이콘. CONFIRMED 행 → 작업지시 발행(잔여>0) + 확정취소. CLOSED는 액션 없음. **마감(close)은 서비스에 구현되어 있으나 현재 그리드 UI에는 버튼이 노출되지 않음**(API 직접 호출/향후 노출 대상).

### 작업지시 발행 로직 (`issueJobOrder`, 트랜잭션)
1. 계획 조회 → `STATUS=CONFIRMED` 아니면 400.
2. `remainQty = planQty − orderQty`. `issueQty > remainQty`면 400.
3. `numbering.nextJobOrderNo()`로 작업지시번호 채번.
4. 품목의 라우팅(`RoutingGroup.useYn='Y'`) → 첫 공정(`RoutingProcess` seq ASC) 해석.
5. `JOB_ORDERS` 생성(status=`WAITING`, erpSyncYn=`N`, lineCode/priority는 dto→plan 상속).
6. `autoCreateChildren=true`면 BOM 전개 재귀 생성(아래).
7. `PROD_PLANS.ORDER_QTY += issueQty`를 SQL update로 원자 증가.

### BOM 반제품 재귀 생성 (`createChildOrdersFromPlanRecursive`)
- 부모 품목의 `BOM_MASTERS`(useYn='Y') 자식 중 **PART_MASTERS.ITEM_TYPE='SEMI_PRODUCT'**인 항목만 자식 작업지시 생성.
- 자식 수량 = `ceil(parent.planQty × qtyPer)`. parentOrderNo/rootOrderNo 체인 기록.
- **순환참조 가드**: 조상 itemCode 경로 추적, 재등장 시 중단(warn). 깊이 50 백스톱.

---

## 채번 (PLAN_NO)
- 형식: `PP-` + `YYYYMM`(planMonth에서 `-` 제거) + `-` + 3자리 zero-pad.
- 알고리즘: 해당 prefix LIKE 조건으로 `ORDER BY planNo DESC` 최상위 1건의 seq +1.
- 일괄(bulkCreate)·자동편성은 동일 트랜잭션 내에서 순차 채번.

> 채번이 Oracle SEQUENCE가 아닌 **SELECT MAX+1** 방식이라 고동시성 병렬 생성 시 PK 충돌 가능성이 있다. 현행은 단일 사용자/순차 입력 전제. 동시 대량 입력이 잦아지면 SEQUENCE 전환을 검토한다.

## 자동편성(MPS) 절차
1. `POST /production/prod-plans/auto-generate/preview` { month, startDate?, endDate?, customerId? } → 수주 기반 후보(items: orderNo·dueDate·itemCode·demandQty·planQty), `existingDraftCount`, `warnings` 반환.
2. 화면에서 항목 체크 선택.
3. `POST /production/prod-plans/auto-generate` { month, selectedItems[] } 실행 → 선택 항목을 DRAFT 생성. **해당 월의 기존 DRAFT는 삭제 후 재편성**(확인 모달, `existingDraftCount` 표시). CONFIRMED/CLOSED는 보존.

## 엑셀 업로드 절차
1. 템플릿 다운로드(`downloadProdPlanTemplate`).
2. 파일 선택 → 프론트 xlsx 파싱(헤더 한/영 매핑) → 행 검증(itemCode 필수, itemType∈{FINISHED,SEMI_PRODUCT}, planQty>0).
3. 오류 0건일 때만 업로드 활성 → `POST /production/prod-plans/bulk` { planMonth, items[] }. 서버는 트랜잭션으로 품목 IN 일괄 검증 후 전건 저장(하나라도 미존재 품목이면 전체 롤백).

## 사전 설정 (마스터·공통코드)
- 공통코드: `PROD_PLAN_STATUS`(상태 배지), `ITEM_TYPE`(필터).
- 마스터: `PART_MASTERS`(품목·품목유형), `PROD_LINES`(라인), `PARTNER_MASTERS`(고객, partnerType='CUSTOMER').
- 작업지시 발행 정상화 전제: 품목에 `ROUTING_GROUPS`(useYn='Y') + `ROUTING_PROCESS` 등록. 미등록 시 routingCode/processCode가 null로 발행됨.
- BOM 자동생성 사용 시: `BOM_MASTERS`(useYn='Y', qtyPer) + 자식 품목의 ITEM_TYPE='SEMI_PRODUCT'.

## 권한
- 생산계획 담당자: 등록/수정/확정/발행. 일반 사용자: 조회.
- ERP 인터페이스 버튼은 현재 **미구현 안내 모달**(준비중)만 노출한다.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 등록 시 "품목을 찾을 수 없습니다" | itemCode가 해당 COMPANY/PLANT 스코프 PART_MASTERS에 없음 | 품목마스터 등록·스코프 확인 |
| 수정/삭제가 막힘(400) | 계획이 CONFIRMED/CLOSED | 확정취소로 DRAFT 복귀 후 처리 |
| 작업지시 발행 버튼 비활성 | 잔여수량 0 또는 CONFIRMED 아님 | 잔여수량/상태 확인 |
| "발행수량이 잔여수량을 초과" | issueQty > planQty−orderQty | 발행수량을 잔여 이하로 |
| 발행된 작업지시에 공정 없음 | 품목 라우팅(useYn='Y')·공정 미등록 | ROUTING_GROUPS/PROCESS 등록 후 재발행 |
| BOM 자동생성 안 됨 | 자식 품목 ITEM_TYPE≠SEMI_PRODUCT 또는 BOM useYn='N' | 품목유형·BOM 사용여부 확인 |
| 자동편성 후 DRAFT가 사라짐 | 같은 월 DRAFT 재편성(설계상 정상) | CONFIRMED 후 자동편성하면 보존 |
| 엑셀 업로드 버튼 비활성 | 검증 오류 행 존재 | 빨간 오류 행 수정(itemCode/itemType/planQty) |

## 데이터·연계
- 테이블: `PROD_PLANS`(주), `PART_MASTERS`(조인), `JOB_ORDERS`(발행 결과), `BOM_MASTERS`/`ROUTING_GROUPS`/`ROUTING_PROCESS`(발행 보조).
- 연계 화면: [품목마스터](/master/part), [작업지시](/production/job-order). 자동편성은 수주(`/shipping/customer-orders`) 참조.
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`. 모든 조회/수정/삭제 where에 COMPANY·PLANT 포함.
