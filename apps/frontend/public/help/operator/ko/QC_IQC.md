---
menuCode: QC_IQC
audience: operator
title: 수입검사(IQC) — 운영 가이드
summary: IQC 화면의 DB 구조·전체 컬럼 매핑, AQL 자동판정 로직, 불합격 시 재고 이동, 파괴검사 자동출고, 판정 취소 조건, 멀티테넌시 스코프 등 운영 핵심 사항
tags: [품질, IQC, 수입검사, 운영, AQL, 불용창고]
keywords: [IQC_LOGS, MAT_LOTS, MAT_ARRIVALS, IQC_PART_SPECS, IQC_PART_SPEC_ITEMS, IQC_ITEM_POOL, PENDING, PASSED, FAILED, IQC_IN_PROGRESS, PASS, FAIL, INITIAL, RETEST, AQL판정, 불용창고, 파괴검사, AUTO_ISSUE, DEFECT_TYPE, DEFECT_GRADE, CRITICAL, MAJOR, MINOR, LSL, USL, INSPECT_DATE, SEQ, 멀티테넌시, COMPANY, PLANT_CD, 검사성적서, CERT_FILE_PATH, 취소, CANCELED]
related: [QC_AQL, MST_PART]
---

# 수입검사(IQC) — 운영 가이드

## 시스템 목적·역할
입하된 자재 LOT의 품질을 검사하고 합·불을 판정하는 화면입니다.
- 판정 결과는 `MAT_LOTS.IQC_STATUS`와 `MAT_ARRIVALS.IQC_STATUS`에 즉시 반영됩니다.
- 불합격(FAIL) 시 해당 입하건의 모든 시리얼이 **불용창고(warehouseType='DEFECT')** 로 자동 이동합니다(`MAT_STOCKS` 수량 0 처리 후 불용창고에 재할당).
- 합격(PASS) 시 품목에 유효기간이 설정된 경우 `MAT_LOTS.EXPIRE_DATE`를 입하일 기준으로 자동 계산합니다.
- `IQC_SAMPLE_ISSUE_MODE = 'AUTO_ISSUE'` 설정 시 PASS + 시료수량이 있으면 파괴검사 시료를 자동 출고합니다(`STOCK_TRANSACTIONS` 기록, `refType='IQC_DESTRUCT'`).
- 판정 후 AQL 공급업체 검사수준이 업데이트됩니다(수입검사 이력 누적 → 검사모드 전환).

## 데이터 구조

```
MAT_LOTS (PK: COMPANY, PLANT_CD, MAT_UID)
   ├─ IQC_STATUS: PENDING / PASS / FAIL  ← IQC 판정 후 갱신
   ├─ ARRIVAL_NO ──▶ MAT_ARRIVALS (입하 헤더, IQC_STATUS 동기)
   └─ ITEM_CODE ──▶ ITEM_MASTERS (품목 정보)
                        └─ IQC_AQL_POLICY_CODE ──▶ IQC_AQL_POLICIES (AQL 정책)
                                                        └─ AQL_STANDARDS → LOT 판정기준

IQC_PART_SPECS (PK: COMPANY, PLANT_CD, ITEM_CODE) ── 품목별 IQC 기준 헤더
   └─ IQC_PART_SPEC_ITEMS (PK: ... ITEM_CODE, SEQ) ── 항목별 LSL/USL/AQL
         └─ INSP_ITEM_CODE ──▶ IQC_ITEM_POOL (전역 검사항목 정의)

IQC_LOGS (PK: INSPECT_DATE, SEQ) ── 검사 이력 1건 (입하단위, matUid=null)
   ├─ ARRIVAL_NO, ITEM_CODE, VENDOR_CODE
   ├─ RESULT: PASS / FAIL
   ├─ DETAILS (CLOB, JSON) ── 시리얼별 측정 상세
   ├─ ITEM_RESULTS (CLOB, JSON) ── 검사항목별 AQL 판정결과
   └─ AQL_* 컬럼들 ── 판정 시 적용된 AQL 기준 스냅샷

MAT_STOCKS ── 재고 수량 (FAIL 시 불용창고 이동)
STOCK_TRANSACTIONS ── 재고 이동/출고 이력 (refType: IQC_FAIL / IQC_DESTRUCT)
```

---

## ① 검사 대상 목록 — MAT_LOTS (집계 뷰)

화면 목록은 `MAT_LOTS`를 `ARRIVAL_NO + ITEM_CODE`로 GROUP BY 집계한 결과입니다.

| 화면 항목 | DB 컬럼/출처 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| 입하번호 | `MAT_LOTS.ARRIVAL_NO` | 입하건 식별자. GROUP BY 키. |
| 입하일 | `MIN(MAT_LOTS.RECV_DATE)` | 입하건의 최초 수령일. |
| 공급업체 | `MAT_LOTS.VENDOR` (→ 협력사명 JOIN) | 납품 거래처 코드 및 이름. |
| 품목코드 | `MAT_LOTS.ITEM_CODE` | GROUP BY 키. |
| 품목명 | `ITEM_MASTERS.ITEM_NAME` | LEFT JOIN. |
| 검사구분 | `ITEM_MASTERS.INSPECT_METHOD` | 공통코드 `IQC_INSPECT_METHOD`. `FULL`=검사, `SKIP`=무검사. `INSPECT_CLASS`(IQC_LOGS legacy 컬럼)와 다름. |
| 시리얼수 | `COUNT(*)` | 해당 입하건의 시리얼 수. |
| 총수량 | `SUM(MAT_LOTS.INIT_QTY)` | 시리얼 전체 초기 수량 합계. |
| 상태 | `MAT_LOTS.IQC_STATUS` | `PENDING`=검사대기, `PASS`=합격(→ 프론트 `PASSED`), `FAIL`=불합격(→ `FAILED`). 화면에서는 `IQC_IN_PROGRESS`도 표시 가능(LOT 일부가 진행 중인 경우). |

---

## ② 검사 이력 — IQC_LOGS (전체 컬럼)

검사 결과 등록 시 입하단위로 1건 생성됩니다(`MAT_UID=null`, 입하단위 검사 표식).

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (복합 PK) | `INSPECT_DATE` | 검사 등록 일시(TIMESTAMP). PK의 일부. |
| (복합 PK) | `SEQ` | 동일 일시 내 순번(기본 1). PK의 일부. |
| 입하번호 | `ARRIVAL_NO` | 검사 대상 입하건. 입하단위 검사 시 필수. |
| 자재 UID | `MAT_UID` | 시리얼별 검사 시 시리얼 식별자. 입하단위 검사(현재 방식)는 `null`. |
| 품목코드 | `ITEM_CODE` | 검사 대상 품목. |
| 공급업체코드 | `VENDOR_CODE` | 납품 협력사 코드(AQL 검사수준 업데이트 기준). |
| 검사유형 | `INSPECT_TYPE` | `INITIAL`=최초검사(기본), `RETEST`=재검사. `RETEST_ROUND`와 함께 사용. |
| 검사결과 | `RESULT` | `PASS` / `FAIL`. 프론트 제출값(`PASSED`/`FAILED`)이 서비스에서 변환됨. |
| 상세내역 | `DETAILS` (CLOB) | 시리얼별·항목별 측정값 JSON. 포맷: `{type:"SERIAL_INSPECTION", serials:[...], destructive:[...]}`. |
| 항목별 판정 | `ITEM_RESULTS` (CLOB) | 검사항목별 AQL 판정결과 JSON. AQL 서비스가 생성. |
| 검사자 | `INSPECTOR_NAME` | 검사 수행자 이름(자유 입력). |
| 검사분류 | `INSPECT_CLASS` | legacy 컬럼. 현재 화면에서 IQC 검사구분(FULL/SKIP) 기록에 사용하지 않음. |
| 파괴시료수 | `DESTRUCT_SAMPLE_QTY` | 파괴검사 시료 수량. 이 값이 0 초과이고 PASS이면 AUTO_ISSUE 모드에서 자동 출고됨. |
| 검사성적서 | `CERT_FILE_PATH` | 업로드된 파일의 서버 경로(`/uploads/iqc/...`). 지원 형식: `.pdf,.jpg,.jpeg,.png,.xlsx,.xls`. 파일 업로드 API로 별도 저장. |
| 시료바코드 | `SAMPLE_BARCODE` | 스캔한 시리얼 목록(콤마 구분). UTF-8 기준 **500바이트 초과 시 자동 축약**(`...(+N more)` 접미어로 대체). |
| LOT 수량 | `LOT_QTY` | AQL 판정 시 사용된 LOT 총수량. |
| AQL 검사수준 | `AQL_INSPECTION_LEVEL` | 적용된 AQL 검사수준(예: `II`). |
| AQL 검사모드 | `AQL_INSPECTION_MODE` | 적용된 검사모드(예: `NORMAL`). |
| AQL 샘플수 | `AQL_SAMPLE_QTY` | AQL 기준으로 산출된 권장 시료 수. |
| Major AQL코드 | `AQL_MAJOR_CODE` | 적용된 Major AQL 기준 코드. |
| Major Ac | `AQL_MAJOR_AC` | Major 합격판정개수. |
| Major Re | `AQL_MAJOR_RE` | Major 불합격판정개수. |
| Minor AQL코드 | `AQL_MINOR_CODE` | 적용된 Minor AQL 기준 코드. |
| Minor Ac | `AQL_MINOR_AC` | Minor 합격판정개수. |
| Minor Re | `AQL_MINOR_RE` | Minor 불합격판정개수. |
| 치명불량수 | `DEFECT_CRITICAL` | Critical 등급 불량 수량. |
| 중결함불량수 | `DEFECT_MAJOR` | Major 등급 불량 수량. |
| 경결함불량수 | `DEFECT_MINOR` | Minor 등급 불량 수량. |
| AQL 판정사유 | `AQL_JUDGE_REASON` | AQL 자동판정 로직의 결과 사유(자동 생성). |
| 상태 | `STATUS` | `DONE`=판정완료(기본), `CANCELED`=취소됨. |
| 재검사회차 | `RETEST_ROUND` | `INSPECT_TYPE=RETEST` 전용. 재검사 차수. |
| 비고 | `REMARK` | 검사 메모. 취소 시 취소 사유도 여기에 기록. |
| 멀티테넌시 | `COMPANY`, `PLANT_CD` | `40` / `1000` 스코프. |
| 생성/수정 | `CREATED_AT`, `UPDATED_AT`, `CREATED_BY`, `UPDATED_BY` | 감사 컬럼. |

---

## ③ 품목별 IQC 기준 — IQC_PART_SPECS / IQC_PART_SPEC_ITEMS

검사 모달에서 품목의 검사항목과 기본시료수를 조회하는 기준 테이블입니다.

### IQC_PART_SPECS (품목별 헤더)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (PK) | `COMPANY`, `PLANT_CD`, `ITEM_CODE` | 복합 PK. 품목당 1행. |
| 기본시료수 | `SAMPLE_QTY` | 검사 모달의 기본시료수 초기값으로 로드됨. 검사자가 수정 가능. |
| 파괴검사여부 | `IS_DEST` | `Y`이면 파괴검사 대상 품목. |
| 사용여부 | `USE_YN` | `N`이면 검사항목 조회에서 제외. |

### IQC_PART_SPEC_ITEMS (항목별 상세)

| 화면 항목 | DB 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|------|
| (PK) | `COMPANY`, `PLANT_CD`, `ITEM_CODE`, `SEQ` | 복합 PK. 순번으로 항목 구분. |
| 검사항목코드 | `INSP_ITEM_CODE` | `IQC_ITEM_POOL.INSP_ITEM_CODE` 참조. 항목명·판정방법·기본 LSL/USL을 가져옴. |
| 하한(LSL) | `LSL` | 계측 합격 하한(없으면 NULL). NULL이면 육안판정으로 처리. |
| 상한(USL) | `USL` | 계측 합격 상한(없으면 NULL). |
| 판정기준 | `JUDGE_CRITERIA` | 육안 판정 기준 설명. |
| 불량등급 | `DEFECT_GRADE` | `CRITICAL`/`MAJOR`/`MINOR`. 공통코드 `DEFECT_GRADE`. 이 등급으로 불량수가 AQL Ac/Re에 대응. |
| 검사수준 | `INSPECTION_LEVEL` | ISO 2859-1 검사수준. 공통코드 `AQL_INSP_LEVEL`. |
| AQL 값 | `AQL` | 항목별 AQL(합격품질한계). 공통코드 `AQL_VALUE`. |
| 검사유형 | `INSPECTION_TYPE` | `AQL`(기본)/`DESTRUCTIVE`(파괴)/`FULL`(전수). NULL은 AQL로 간주. 공통코드 `IQC_ITEM_INSP_TYPE`. |
| 샘플방식 | `SAMPLE_METHOD` | `AQL`(자동)/`FIXED`(고정). NULL은 AQL. 공통코드 `IQC_SAMPLE_METHOD`. |
| 고정시료수 | `SAMPLE_QTY` | `INSPECTION_TYPE=DESTRUCTIVE/FULL`이거나 `SAMPLE_METHOD=FIXED`인 항목의 LOT당 고정 시료 수. |
| 사용여부 | `USE_YN` | `N`이면 검사 시 표시 안 됨. |

### IQC_ITEM_POOL (전역 검사항목 정의)

| 컬럼 | 역할 / 의미 · 운영 포인트 |
|------|------|
| `INSP_ITEM_CODE` | 검사항목 고유 코드(PK). 예: `IQC-001`. |
| `INSP_ITEM_NAME` | 검사항목명. 모달 검사항목 열에 표시됨. |
| `JUDGE_METHOD` | `VISUAL`(육안)/`MEASURE`(계측). 계측이면 측정값 입력란이 활성화됨. |
| `CRITERIA` | 기본 판정 기준. `IQC_PART_SPEC_ITEMS.JUDGE_CRITERIA`가 없으면 이 값을 사용. |
| `LSL`, `USL`, `UNIT` | 기본 합격 범위. 항목에서 재정의 가능. |
| `REVISION`, `EFFECTIVE_DATE` | 검사항목 개정 이력 관리. |

---

## 검사결과 등록 버튼 활성화 조건 (canSubmit)

```typescript
canSubmit =
  (scannedSerials.length > 0 || (aqlItems.length === 0 && destructItems.length > 0))
  && !loadingItems
  && !isIncomplete          // 모든 시리얼 판정 완료
  && (!needsDefectCode || hasDefectCodeRows)   // FAIL이면 불량코드 필수
  && !hasContradictingDefectCodes              // PASS인데 불량코드 있으면 차단
```

- `needsDefectCode`: `(anyFail || anyDestructFail) && !hasDefectCodeRows`
- `hasContradictingDefectCodes`: `!(anyFail || anyDestructFail) && hasDefectCodeRows`
- 불량코드 유효성: `defectCode != "" && qty > 0`인 행이 1개 이상

## AQL 판정 로직

입하단위 검사결과 등록(`POST /material/iqc-history/arrival`) 시 아래 순서로 최종 결과가 결정됩니다.

```
1. 입하건의 PENDING 시리얼 전체 조회 → LOT 총수량 산출
2. DETAILS JSON 파싱 → 시리얼별 항목별 FAIL 집계(itemDefectCounts)
3. 파괴검사(destructive) 섹션 파싱 → 항목별 inspectedQty/defectQty 집계
4. AQL 서비스 resolveIqcPolicyByItem 호출:
   a. 품목의 IQC_AQL_POLICY_CODE → IQC_AQL_POLICIES 조회
   b. 치명결함(CRITICAL)이 있고 criticalMode='IMMEDIATE_FAIL' → 즉시 FAIL
   c. defectGrade 설정 항목: 항목별 inspectionLevel/AQL로 LOT 구간 조회 → Ac/Re 비교
   d. 항목에 등급 미설정 시: 전체 Major/Minor Ac/Re로 폴백
   e. Major 또는 Minor 불량수 ≥ Re → FAIL / ≤ Ac → PASS
5. 최종 result(PASS/FAIL)로 PENDING 시리얼 일괄 업데이트
6. IQC_LOGS 1건 생성 (AQL 기준 스냅샷 컬럼 저장)
7. FAIL → 불용창고 자동이동 (STOCK_TRANSACTIONS refType='IQC_FAIL')
8. PASS + 유효기간 → EXPIRE_DATE 자동 계산
9. PASS + 시료수 > 0 + AUTO_ISSUE 모드 → 파괴시료 자동출고 (refType='IQC_DESTRUCT')
10. AQL 공급업체 검사수준 업데이트
```

> 불량코드 입력(`defects[]`) 시 FAIL 판정 항목이 없으면 400 오류로 차단됩니다(`assertDefectCodesHaveFailedInspection`).

---

## 판정 취소 조건

`DELETE /material/iqc-history/{inspectDate}/{seq}` 호출 시 아래 조건을 확인합니다.

| 조건 | 동작 |
|------|------|
| 이미 `STATUS='CANCELED'` | 400 오류 ("이미 취소된 판정") |
| 해당 입하건에 입고(`MAT_RECEIVINGS.STATUS='DONE'`) 존재 | 400 오류 ("이미 입고된 입하건") |
| PASS이고 파괴시료 자동출고(`refType='IQC_DESTRUCT'`) 존재 | 400 오류 ("시료 출고 먼저 정리") |
| FAIL이고 불용창고 이동 이력 존재 | 자동 역이동(`refType='IQC_FAIL_CANCEL'`) 후 취소 허용 |
| 취소 성공 | `IQC_LOGS.STATUS='CANCELED'`, 시리얼 → `IQC_STATUS='PENDING'` 복원 |

---

## API 경로

| 목적 | 메서드 | 경로 | 비고 |
|------|------|------|------|
| 검사대기 목록 조회 | GET | `/material/iqc-history/pending-arrivals` | |
| 검사대기 시리얼 조회 | GET | `/material/iqc-history/pending-serials` | `?arrivalNo=&itemCode=` |
| 입하단위 검사결과 등록 | POST | `/material/iqc-history/arrival` | DETAILS JSON 포함 |
| 검사성적서 업로드 | POST | `/material/iqc-history/{inspectDate}/{seq}/upload-cert` | 파일 multipart |
| 판정 취소 | DELETE | `/material/iqc-history/{inspectDate}/{seq}` | STATUS→CANCELED, 시리얼→PENDING 복원 |
| 품목 검사항목 조회 | GET | `/master/iqc-part-specs/{itemCode}/resolve-items` | inspectionType 포함 |
| 품목 기준 헤더 조회 | GET | `/master/iqc-part-specs/{itemCode}` | sampleQty 초기값 |
| AQL 샘플수량 조회 | GET | `/quality/aql/resolve-iqc-items` | `?itemCode=&vendorCode=&lotQty=` |
| 불량코드 목록 조회 | GET | `/quality/defect-codes/options` | `?productType={defectModelGroup}` — 품목 defectModelGroup으로 필터 |
| 검사자(작업자) 목록 조회 | GET | `/master/workers/options` | 부서=`품질팀` 필터 적용 |

---

## 사전 설정 (마스터·공통코드)

- 공통코드: `IQC_INSPECT_METHOD`(FULL/SKIP), `IQC_STATUS`, `DEFECT_TYPE`(불량코드, `ATTR1`에 등급 필수), `DEFECT_GRADE`(CRITICAL/MAJOR/MINOR), `IQC_ITEM_INSP_TYPE`(AQL/DESTRUCTIVE/FULL), `IQC_SAMPLE_METHOD`(AQL/FIXED), `AQL_INSP_LEVEL`, `AQL_VALUE`
- `ITEM_MASTERS.IQC_FLAG='Y'` 설정 필수 (IQC 대상 품목)
- `WORKER_MASTERS` — 검사자 선택 목록: 부서(`DEPT`)='품질팀'인 작업자만 표시됨
- `IQC_ITEM_POOL` — 검사항목 풀 등록 필요
- `IQC_PART_SPECS` + `IQC_PART_SPEC_ITEMS` — 품목별 검사항목 구성 필요
- `IQC_AQL_POLICIES` — AQL 정책 설정 및 품목 연결 필요
- 불용창고(`warehouseType='DEFECT'`, `USE_YN='Y'`) 등록 필수 — 없으면 불합격 재고 이동 불가(에러 없이 스킵됨)
- 불량코드(`DEFECT_CODES`) — `ITEM_MASTERS.DEFECT_MODEL_GROUP` 컬럼이 설정된 경우 해당 그룹 코드 불량만 선택 목록에 나타남. 그룹 미설정 시 전체 불량코드 표시

---

## 권한

| 역할 | 가능 작업 |
|------|------|
| 검사 담당자 | 검사결과 등록, 시리얼 스캔, 성적서 업로드 |
| 품질 관리자 | 위 + 판정 취소 |
| 운영자 | 위 + 공통코드·기준 설정 |

---

## 문제 해결 (트러블슈팅)

| 증상 | 원인 | 조치 |
|------|------|------|
| 검사 버튼 비활성화 | 상태가 PASSED/FAILED | 판정 취소 필요(운영자). 입고 이력이 없어야 취소 가능 |
| AQL 샘플수량이 표시 안 됨 | 품목에 AQL 정책 미연결 | 품목마스터에서 `IQC_AQL_POLICY_CODE` 설정 |
| 불합격 처리 후 재고가 불용창고로 안 이동 | 불용창고(`warehouseType='DEFECT'`) 미등록 | 창고마스터에 DEFECT 타입 창고 등록 |
| 취소 시 "이미 입고된 입하건" 오류 | 해당 입하건이 이미 입고(MAT_RECEIVINGS DONE) | 입고 취소 후 IQC 판정 취소 |
| 취소 시 "시료 출고 먼저 정리" 오류 | IQC_DESTRUCT 자동출고 이력 존재 | 해당 STOCK_TRANSACTIONS 취소 후 재시도 |
| 검사항목이 모달에 표시 안 됨 | `IQC_PART_SPECS`/`IQC_PART_SPEC_ITEMS` 미등록 또는 `USE_YN='N'` | IQC 검사항목 마스터 설정 확인 |
| 불량코드 입력 후 등록 차단 | FAIL 판정 없이 불량코드 입력 | 불량코드는 FAIL 판정 항목이 있어야 등록 가능 |
| ORA-04068 (첫 호출 500) | 테이블 DDL 후 PL/SQL 패키지 INVALID | `ALTER PACKAGE <패키지명> COMPILE` 실행 또는 재시도 (callProc는 1회 재시도 하드닝) |
| 파괴시료 자동출고 안 됨 | `IQC_SAMPLE_ISSUE_MODE != 'AUTO_ISSUE'` 또는 `DESTRUCT_SAMPLE_QTY=0` | 시스템 설정 `IQC_SAMPLE_ISSUE_MODE='AUTO_ISSUE'` 확인 및 시료수 입력 |

---

## 데이터·연계

- **주요 테이블**: `IQC_LOGS`, `MAT_LOTS`, `MAT_ARRIVALS`, `IQC_PART_SPECS`, `IQC_PART_SPEC_ITEMS`, `IQC_ITEM_POOL`
- **재고 테이블**: `MAT_STOCKS`(재고), `STOCK_TRANSACTIONS`(이동/출고 이력)
- **마스터 테이블**: `ITEM_MASTERS`(품목), `IQC_AQL_POLICIES`, `AQL_STANDARDS`(AQL 기준)
- **연계 화면**: [AQL 기준관리](/quality/aql), [품목마스터](/master/part), 자재입고, 수입검사이력
- **멀티테넌시 스코프**: `COMPANY='40'`, `PLANT_CD='1000'`. 모든 조회·저장에 tenant 파라미터 포함. `assertSameTenant`로 교차 접근 차단.
