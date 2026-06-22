---
menuCode: QC_REQUEST_INSPECT
audience: operator
title: 의뢰검사 입력 — 운영 가이드
summary: 자주검사 의뢰검사(DELEGATE) 대기 건의 측정값 입력·판정 화면. SELF_INSPECT_RESULTS/SELF_INSPECT_ITEMS 컬럼·DB 매핑, 상태 전이, 키오스크 차단 연계, 트러블슈팅
tags: [품질, 자주검사, 의뢰검사, DELEGATE, 운영]
keywords: [SELF_INSPECT_RESULTS, SELF_INSPECT_ITEMS, DELEGATE, DIRECT, PENDING, PASS, FAIL, INSPECT_METHOD, STATUS, MEASURE_VALUE, LSL_VALUE, USL_VALUE, ITEM_TYPE, MEASURE, VISUAL, TIMING, INSPECTED_AT, 키오스크 차단, 자주검사]
related: [QC_AQL]
---

# 의뢰검사 입력 — 운영 가이드

## 시스템 목적·역할
공정 **자주검사**(SELF_INSPECT) 중 검사 방법이 **의뢰검사(DELEGATE)** 인 항목은 키오스크에서 작업자가 직접 판정하지 않고 결과 레코드를 `STATUS='PENDING'` 으로 적재합니다. 이 화면은 그 대기 건을 품질담당이 조회해 **측정값을 입력하고 PASS/FAIL로 확정**하는 관리 화면입니다. 직접검사(DIRECT)는 키오스크에서 즉시 PASS/FAIL이 확정되므로 이 화면에 나타나지 않습니다.

> 핵심 연계: 특정 작업지시에 `INSPECT_METHOD='DELEGATE' AND STATUS='PENDING'` 인 결과가 1건이라도 있으면 해당 작업지시의 **키오스크 생산실적 입력이 차단**됩니다(엔티티 주석 기준). 본 화면에서 판정을 끝내야 차단이 해소됩니다.

## 데이터 구조
의뢰검사 결과는 결과 테이블에 적재되고, 검사 기준(규격·유형·단위)은 항목 마스터에서 JOIN해 옵니다.

```
SELF_INSPECT_ITEMS (검사항목 마스터)            SELF_INSPECT_RESULTS (검사 결과)
  ID (PK) ─────────────────┐                     ID (PK)
  INSPECT_METHOD=DELEGATE   │  INSPECT_ITEM_ID    INSPECT_ITEM_ID ──(LEFT JOIN i.id)
  ITEM_TYPE / LSL / USL /   └─────────────────────  INSPECT_METHOD = 'DELEGATE'
  UNIT / STANDARD                                   STATUS = 'PENDING' → 이 화면 대상
```

- 대기 목록 쿼리: `SELF_INSPECT_RESULTS r LEFT JOIN SELF_INSPECT_ITEMS i ON i.ID = r.INSPECT_ITEM_ID`, 조건 `r.INSPECT_METHOD='DELEGATE' AND r.STATUS='PENDING' AND r.COMPANY/PLANT_CD 스코프`, 정렬 `r.CREATED_AT ASC`.
- API: 목록 `GET /production/self-inspect/delegates`, 판정 `PATCH /production/self-inspect/results/:id/status`.
- (참고) 화면 좌측 그리드의 `sqlQuery` 표시용 문구는 `INSPECT_REQUESTS` 를 가리키지만, 실제 데이터 소스는 위 `SELF_INSPECT_RESULTS` 입니다(표시용 SQL 라벨일 뿐 조회 경로 아님).

---

## ① 대기 목록 / 결과 — SELF_INSPECT_RESULTS (관련 컬럼)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (행 식별) | `ID` | PK(UUID, `PrimaryGeneratedColumn('uuid')`). 판정 PATCH의 `:id`. |
| 작업지시 | `ORDER_NO` | 검사가 발생한 작업지시 번호. 인덱스 존재. 키오스크 차단 판단 키. |
| 공정 | `PROCESS_CODE` | 검사 발생 공정 코드(nullable). |
| (검사항목 키) | `INSPECT_ITEM_ID` | `SELF_INSPECT_ITEMS.ID` 참조(nullable). 규격/유형/단위 JOIN 키. |
| 항목명 | `ITEM_NAME` | 검사 항목명(결과 시점 스냅샷, 길이 200). |
| 시점 | `TIMING` | `FIRST`(초물) / `MID`(중물) / `LAST`(종물). 결과는 단일 시점값. |
| (검사방법) | `INSPECT_METHOD` | `DIRECT`(직접) / `DELEGATE`(의뢰). 이 화면은 `DELEGATE`만 대상. 기본값 `DIRECT`. |
| (상태) | `STATUS` | `PENDING`(대기) / `PASS`(합격) / `FAIL`(불합격). 기본값 `PENDING`. 인덱스 존재. PENDING만 목록 노출. |
| 측정값 | `MEASURE_VALUE` | NUMBER, nullable. MEASURE 항목만 사용, VISUAL은 null. 판정 시 함께 저장. |
| 비고 | `REMARK` | varchar2(500), nullable. 특이사항/판정 사유. |
| 시료번호 | `SAMPLE_NO` | NUMBER, 기본 1. FIRST 초물 N개 시료 시 1..N, MID/LAST는 1. (목록 조회엔 포함되나 그리드 미표시) |
| 요청일시 | `CREATED_AT` | `CreateDateColumn`. 의뢰 시각. 목록 정렬(ASC) 기준. |
| (검사완료시각) | `INSPECTED_AT` | timestamp, nullable. **PENDING이 아닌 상태로 전이될 때(`status !== 'PENDING'`) `new Date()`로 세팅**. 미판정이면 null. |
| (생산수량) | `PROD_QTY_AT_INSPECT` | NUMBER, nullable. 검사 당시 생산 수량(키오스크 적재값). 본 화면 미표시. |
| (장비) | `EQUIP_CODE` | varchar2(50), nullable. 검사 설비 코드. 본 화면 미표시. |
| (검사자) | `INSPECTOR_ID` | varchar2(50), nullable. 본 화면 미표시. |
| 감사 | `CREATED_BY`, `UPDATED_BY`, `UPDATED_AT` | 생성/수정 사용자·수정시각. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `COMPANY='40'`, `PLANT_CD='1000'` 스코프. 목록·판정 모두 스코프 필터. |

---

## ② 검사 기준(JOIN 표시) — SELF_INSPECT_ITEMS (대기 목록에서 가져오는 컬럼)

대기 목록은 항목 마스터에서 아래 컬럼을 LEFT JOIN해 오른쪽 입력 영역의 "검사 기준"을 구성합니다.

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (항목유형) | `ITEM_TYPE` | `MEASURE`(측정형) / `VISUAL`(판정형). MEASURE인데 규격이 없으면 "설정된 규격(LSL/USL)이 없습니다", VISUAL이면 "판정형 항목 (규격 없음)" 표시. 기본값 `VISUAL`. |
| LSL | `LSL_VALUE` | NUMBER, nullable. 규격 하한. LSL/USL 중 하나라도 있으면 검사 기준 박스에 수치 표시. |
| USL | `USL_VALUE` | NUMBER, nullable. 규격 상한. |
| 단위 | `UNIT` | varchar2(20), nullable. 측정 단위(mm, N 등). 있을 때만 표시. |
| 기준/규격 | `STANDARD` | varchar2(500), nullable. 텍스트 기준. 있을 때만 표시. |

> `INSPECT_ITEM_ID`가 null이거나 매칭되는 항목 마스터가 없으면(LEFT JOIN miss) LSL/USL/단위/기준이 비어 "규격 없음"으로 나옵니다. 측정형 항목인데 규격이 비면 항목 마스터에서 LSL/USL을 채워야 합니다.

---

## 판정 로직 (PATCH /results/:id/status)
1. `id` + COMPANY/PLANT_CD 스코프로 결과 레코드 조회. 없으면 404(`SelfInspectResult {id} not found`).
2. `STATUS`를 요청값(`PASS`/`FAIL`)으로 변경.
3. `remark`가 전달되면 `REMARK` 갱신, `measureValue`가 전달되면 `MEASURE_VALUE` 갱신(undefined면 기존 유지).
4. `status !== 'PENDING'` 이면 `INSPECTED_AT = 현재시각` 세팅(= 검사 완료 시각 기록).
5. 저장. 응답 메시지 `상태가 {status}로 변경되었습니다`.

> 합격/불합격 판정은 LSL/USL 자동 비교가 아니라 **담당자 수동 판정**입니다. 화면은 PASS/FAIL 버튼 클릭값을 그대로 STATUS에 반영합니다(규격은 참고용 표시).

## 사전 설정 (마스터)
- 공정 자주검사 항목 마스터(`SELF_INSPECT_ITEMS`)에서 해당 항목의 `INSPECT_METHOD='DELEGATE'` 설정 → 키오스크가 직접 판정 대신 PENDING 결과를 생성.
- 측정형 항목은 `ITEM_TYPE='MEASURE'` + `LSL_VALUE`/`USL_VALUE`/`UNIT` 채워 두면 이 화면에 규격이 표시됨.
- 항목 마스터 등록·수정은 자주검사 항목 관리 API(`/production/self-inspect/items`)로 수행.

## 운영 절차
1. 화면 진입 시 자동으로 `GET /delegates` 호출 → 대기 목록 로드(오래된 순).
2. 항목 선택 → 측정 → 측정값/비고 입력 → PASS/FAIL.
3. 판정 후 목록 자동 재조회, 처리 건 제거.
4. 대량 적체 시 작업지시별로 처리해 해당 지시의 키오스크 차단을 우선 해소.

## 권한
JWT 인증 필요(`JwtAuthGuard`). 품질담당이 판정 수행. 멀티테넌시 스코프(COMPANY/PLANT_CD)는 토큰 컨텍스트에서 주입.

## 문제 해결 (트러블슈팅)
| 증상 | 원인 | 조치 |
|------|------|------|
| 키오스크에서 실적입력이 막힘 | 해당 작업지시에 `DELEGATE`+`PENDING` 결과 잔존 | 이 화면에서 대상 항목 PASS/FAIL 판정 → 대기 해소 |
| 대기 목록에 항목이 안 보임 | 직접검사(DIRECT)거나 이미 PASS/FAIL 처리됨, 또는 다른 COMPANY/PLANT 스코프 | 의뢰검사 항목인지, 현재 사이트 스코프인지 확인 |
| LSL/USL·단위가 비어 있음 | 항목이 VISUAL이거나 `INSPECT_ITEM_ID` 매칭 항목에 규격 미설정/JOIN miss | 측정형이면 항목 마스터에 LSL/USL/UNIT 입력 |
| 판정 시 404 | 다른 스코프의 ID이거나 이미 삭제됨 | 현재 사이트(COMPANY=40/PLANT=1000) 데이터인지 확인 후 재조회 |
| 측정값 저장 안 됨 | 빈 문자열은 전송되지 않음(undefined) | 숫자 입력 후 판정 버튼 클릭 |

## 데이터·연계
- 테이블: `SELF_INSPECT_RESULTS`(결과·상태), `SELF_INSPECT_ITEMS`(검사 기준 JOIN).
- API: `GET /production/self-inspect/delegates`, `PATCH /production/self-inspect/results/:id/status`. 연관: `GET /pending/:orderNo`(키오스크 차단 판단), `POST /results`(키오스크 의뢰 적재).
- 연계 화면: 생산 키오스크(자주검사 의뢰·실적 차단), 자주검사 항목 관리(`SELF_INSPECT_ITEMS`).
- 스코프: `COMPANY='40'`, `PLANT_CD='1000'`.
