# HARNESS MES 데이터베이스 컬럼 도메인 정의서

> 작성일: 2026-03-19 | 대상: 125개 테이블, 2039개 컬럼

## 1. 표준 도메인 정의

### 1.1 식별자 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_CODE` | VARCHAR2(50) | 코드성 식별자 (PK, FK) | ITEM_CODE, EQUIP_CODE, MOLD_CODE, CONSUMABLE_CODE, PROCESS_CODE |
| `D_CODE_SHORT` | VARCHAR2(20) | 짧은 코드 (공통코드, 구분값) | GROUP_CODE, STATUS, LOG_TYPE, ITEM_TYPE |
| `D_CODE_LONG` | VARCHAR2(100) | 긴 코드 (외부 시스템 연계) | BARCODE, SERIAL_NO, MAT_UID |
| `D_NO` | VARCHAR2(50) | 채번 번호 (업무번호) | ORDER_NO, RESULT_NO, REWORK_NO, FAI_NO, CAPA_NO |
| `D_UID` | VARCHAR2(50) | 고유 인스턴스 ID | CON_UID, MAT_UID, PRD_UID |

### 1.2 명칭 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_NAME` | VARCHAR2(100) | 기본 명칭 | ITEM_NAME, EQUIP_NAME, PROCESS_NAME |
| `D_NAME_LONG` | VARCHAR2(200) | 긴 명칭 | CUSTOMER_NAME, DESCRIPTION(짧은) |
| `D_LABEL` | VARCHAR2(50) | 라벨/축약명 | CATEGORY, MAKER, VENDOR |

### 1.3 설명/비고 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_REMARK` | VARCHAR2(500) | 비고 (통일: REMARK) | REMARK |
| `D_DESC` | VARCHAR2(2000) | 상세 설명 | DESCRIPTION |
| `D_REASON` | VARCHAR2(500) | 사유 | RETURN_REASON, ISSUE_REASON, REJECT_REASON |

### 1.4 수량/금액 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_QTY` | NUMBER(12) | 수량 (정수) | QTY, STOCK_QTY, PLAN_QTY, SAFETY_STOCK |
| `D_PRICE` | NUMBER(12,2) | 단가 | UNIT_PRICE |
| `D_AMOUNT` | NUMBER(14,2) | 금액 합계 | TOTAL_AMOUNT |
| `D_DECIMAL` | NUMBER(12,4) | 계측값/스펙 | LSL, USL, MEASURED_VALUE |
| `D_COUNT` | NUMBER(10) | 카운트/타수 | SHOT_COUNT, CURRENT_COUNT, SEQ |
| `D_FLOAT` | NUMBER | 비율/퍼센트 | YIELD_RATE, DEFECT_RATE |

### 1.5 날짜/시간 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_DATE` | DATE | 업무 일자 (시간 불필요) | TRANS_DATE, DUE_DATE, INSPECT_DATE |
| `D_TIMESTAMP` | TIMESTAMP | 정밀 시각 | CREATED_AT, UPDATED_AT |
| `D_DATE_NULLABLE` | DATE | 선택적 일자 | SCHEDULED_DATE, EFFECTIVE_DATE |

### 1.6 플래그 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_YN` | VARCHAR2(1) | Y/N 플래그 | USE_YN, IS_ACTIVE, IS_DEFAULT |

### 1.7 멀티테넌시 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_COMPANY` | VARCHAR2(50) | 회사코드 | COMPANY |
| `D_PLANT` | VARCHAR2(50) | 사업장코드 | PLANT_CD |

### 1.8 감사(Audit) 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_USER_ID` | VARCHAR2(50) | 사용자 ID | CREATED_BY, UPDATED_BY, WORKER_ID |
| `D_AUDIT_TS` | TIMESTAMP | 감사 시각 | CREATED_AT, UPDATED_AT |

### 1.9 URL/경로 도메인

| 도메인명 | Oracle 타입 | 설명 | 적용 컬럼 예시 |
|----------|------------|------|---------------|
| `D_URL` | VARCHAR2(500) | URL/파일경로 | IMAGE_URL, PHOTO_URL, FILE_URL |
| `D_EMAIL` | VARCHAR2(255) | 이메일 | EMAIL |
| `D_ADDRESS` | VARCHAR2(500) | 주소 | ADDRESS |

---

## 2. 도메인 불일치 현황 (86건)

### 2.1 Critical — 핵심 공통 컬럼 (즉시 통일 필요)

| 컬럼명 | 표준 도메인 | 현재 문제 | 영향 테이블 수 |
|--------|------------|----------|-------------|
| **COMPANY** | `D_COMPANY` VARCHAR2(50) | 50/255/20 혼재 | 118 |
| **PLANT_CD** | `D_PLANT` VARCHAR2(50) | 50/255/20 혼재 | 96 |
| **CREATED_BY** | `D_USER_ID` VARCHAR2(50) | 50/255 혼재 | 110 |
| **UPDATED_BY** | `D_USER_ID` VARCHAR2(50) | 50/255 혼재 | 103 |
| **CREATED_AT** | `D_AUDIT_TS` TIMESTAMP | timestamp/varchar2 혼재 | 125 |
| **UPDATED_AT** | `D_AUDIT_TS` TIMESTAMP | timestamp/varchar2 혼재 | 115 |
| **STATUS** | `D_CODE_SHORT` VARCHAR2(20) | 20/30/50 혼재 | 53 |
| **ITEM_CODE** | `D_CODE` VARCHAR2(50) | 50/255 혼재 | 39 |
| **SEQ** | `D_COUNT` NUMBER(10) | int/number 혼재 | 39 |

### 2.2 Major — 업무 공통 컬럼

| 컬럼명 | 표준 도메인 | 현재 문제 | 영향 테이블 수 |
|--------|------------|----------|-------------|
| **REMARK** vs **REMARKS** | `D_REMARK` VARCHAR2(500) | 컬럼명 불일치 (53 vs 16) | 69 |
| **WORKER_ID** | `D_USER_ID` VARCHAR2(50) | 50/255 혼재 | 16 |
| **EQUIP_CODE** | `D_CODE` VARCHAR2(50) | 50/36 혼재 | 15 |
| **DESCRIPTION** | `D_DESC` VARCHAR2(2000) | 100/200/500/1000/2000 혼재 | 16 |
| **LINE_CODE** | `D_CODE` VARCHAR2(50) | 50/255 혼재 | 12 |
| **PROCESS_CODE** | `D_CODE` VARCHAR2(50) | 50/255 혼재 | 14 |
| **ITEM_NAME** | `D_NAME` VARCHAR2(100) | 100/200/255 혼재 | 11 |
| **UNIT_PRICE** | `D_PRICE` NUMBER(12,2) | 12,2/12,4/15,2/float 혼재 | 10 |
| **ORDER_NO** | `D_NO` VARCHAR2(50) | 50/36 혼재 | 13 |
| **VENDOR_NAME** | `D_NAME` VARCHAR2(100) | 100/200/255 혼재 | 5 |
| **EMAIL** | `D_EMAIL` VARCHAR2(255) | 100/255 혼재 | 5 |

### 2.3 Minor — 개별 테이블 간 차이

| 컬럼명 | 문제 | 표준 |
|--------|------|------|
| TRANS_DATE | DATE vs TIMESTAMP 혼재 | `D_DATE` DATE |
| DUE_DATE | TIMESTAMP vs DATE 혼재 | `D_DATE` DATE |
| INSPECT_DATE | DATE vs TIMESTAMP 혼재 | `D_DATE` DATE |
| RECV_DATE | TIMESTAMP vs DATE 혼재 | `D_DATE` DATE |
| TOTAL_AMOUNT | 15,2 vs 14,2 혼재 | `D_AMOUNT` NUMBER(14,2) |
| LSL/USL | 10,4 vs 12,4 혼재 | `D_DECIMAL` NUMBER(12,4) |
| SAFETY_STOCK | INT vs FLOAT 혼재 | `D_QTY` NUMBER(12) |
| PRIORITY | VARCHAR2/INT 혼재 | `D_CODE_SHORT` VARCHAR2(20) |
| IS_DEFAULT | VARCHAR2/NUMBER 혼재 | `D_YN` VARCHAR2(1) |
| IS_ACTIVE | CHAR(1)/VARCHAR2(1) 혼재 | `D_YN` VARCHAR2(1) |

---

## 3. 유사 컬럼명 정리 대상

| 현재 | 통일 안 | 비고 |
|------|---------|------|
| REMARK (53) / REMARKS (16) | **REMARK** 통일 | REMARKS → REMARK로 rename |
| PLANT_CD (96) | **PLANT_CD** 유지 | 일부 PLANT로 된 곳 확인 필요 |
| CAPA_ID (int vs varchar2) | **VARCHAR2(30)** 통일 | CUSTOMER_COMPLAINTS의 int 수정 |
| DEFECT_LOG_ID (number vs varchar2) | **VARCHAR2(50)** 통일 | REPAIR_LOGS의 number 수정 |
| PM_PLAN_ID (varchar2 vs raw) | **VARCHAR2(50)** 통일 | PM_WORK_ORDERS의 raw 수정 |
| PRD_UID (50/80/255) | **VARCHAR2(50)** 통일 | PROD_RESULTS, REWORK_ORDERS 수정 |

---

## 4. 엔티티별 주요 불일치 테이블 (VARCHAR2(255) 사용 — shipping 모듈)

다음 테이블들은 COMPANY, PLANT_CD, CREATED_BY 등을 VARCHAR2(255)로 정의:

- BOX_MASTERS
- CUSTOMER_ORDER_ITEMS / CUSTOMER_ORDERS
- DEFECT_LOGS
- INSPECT_RESULTS
- JOB_ORDERS
- PALLET_MASTERS
- PROCESS_MAPS / PROCESS_MASTERS (일부)
- PROD_LINE_MASTERS / PROD_PLANS / PROD_RESULTS
- PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS
- REPAIR_LOGS / REPAIR_ORDERS / REPAIR_USED_PARTS
- SHIPMENT_LOGS / SHIPMENT_ORDERS / SHIPMENT_RETURNS
- SUBCON_* (외주 관련)
- WORKER_MASTERS

**원인**: shipping/production/quality 모듈 엔티티가 일괄적으로 VARCHAR2(255)를 사용.
**조치**: 표준 도메인(VARCHAR2(50))으로 통일 필요.

---

## 5. 정리 우선순위

### P1 — 즉시 (엔티티 수정만으로 해결)
1. REMARKS → REMARK 통일 (16개 엔티티)
2. IS_ACTIVE CHAR(1) → VARCHAR2(1) 통일
3. IS_DEFAULT NUMBER → VARCHAR2(1) 통일

### P2 — 단기 (DB DDL + 엔티티)
4. COMPANY VARCHAR2(255) → VARCHAR2(50) (shipping 등 모듈)
5. PLANT_CD VARCHAR2(255) → VARCHAR2(50)
6. CREATED_BY/UPDATED_BY VARCHAR2(255) → VARCHAR2(50)
7. STATUS VARCHAR2(30/50) → VARCHAR2(20) 통일

### P3 — 중기 (데이터 검증 후)
8. UNIT_PRICE decimal 정밀도 통일 (12,2)
9. TOTAL_AMOUNT decimal 정밀도 통일 (14,2)
10. TRANS_DATE/DUE_DATE 타입 통일 (DATE)
11. PRD_UID 길이 통일 (50)
12. CAPA_ID/DEFECT_LOG_ID 타입 통일 (VARCHAR2)
