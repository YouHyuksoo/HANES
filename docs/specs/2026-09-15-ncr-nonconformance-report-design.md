# 부적합 보고서(NCR) 설계

- 작성일: 2026-09-15
- 상태: 설계 (구현 전)
- 참고: 고객 제공 NCR 양식(부적합 보고서 / Nonconformance Report) 1페이지

## 1. 배경

부적합이 생겨도 **하나의 문서로 묶여 추적되지 않는다.** 지금은 발생 경로마다 다른 테이블에
따로 쌓이고, 처리(재작업·수리)와 시정조치(CAPA)가 각각 따로 채번돼 따로 산다.

JSHANES 실측(2026-09-15):

| 테이블 | 건수 | 단계 |
|---|---|---|
| `IQC_LOGS` | 160 | 원자재 수입검사 |
| `INSPECT_RESULTS` (PASS_YN='N') | 5 | 완제품 통전·구조·통합검사 |
| `DEFECT_LOGS` | 0 | 생산 불량 기록(미사용 상태) |

감사에서 "이 부적합 건 보여주세요" 하면 화면 셋을 따로 열어야 한다.

## 2. 양식 대비 현황

양식 항목의 상당수가 이미 데이터로 존재한다. **새로 만드는 것보다 꿰는 일에 가깝다.**

| 양식 항목 | 기존 자산 | 판정 |
|---|---|---|
| 품명·규격·수량·로트번호 | `ITEM_MASTERS`, `MAT_LOTS`, `SG_LABELS`, `FG_LABELS` | 재사용 |
| 제조일자 / P.O No / 납기일자 | `MANUFACTURE_DATE`, `PURCHASE_ORDERS`, `SHIPMENT_ORDERS` | 재사용 |
| 검사의뢰일 / 검사일 | `/quality/request-inspect`, `INSPECT_RESULTS.INSPECT_TIME` | 재사용 |
| 부적합명 | `DEFECT_CODE_MASTERS.DEFECT_NAME` | 재사용 |
| 분류(내전압/외관/구조/특성) | `DEFECT_CATEGORY_MASTERS` (고전압·저전압·기능·외관·기타) | 재사용 |
| **결함구분 치명/중/경** | `DEFECT_GRADE` = `CRITICAL/MAJOR/MINOR` | **3단계 일치** (§2-1 참조) |
| **처리방안 진행/수리/재작업/폐기** | `DEFECT_DISPOSITION` = `CONCESSION/REPAIR/REWORK/SCRAP` | **4종 일치** |
| 사진 증빙 | `DEFECT_LOGS.IMAGE_URL` 선례 | 재사용 |
| 원인·재발방지·검증·종결 | `CAPA_REQUESTS` (ROOT_CAUSE/ACTION_PLAN/VERIFIED_*/CLOSED_AT) | 연계 |

**없는 것**: NCR 번호로 묶는 문서, 결재선, 4M1E 원인 분류, 회신요구일,
반품(Return to Vendor) 처리구분, 부적합→CAPA 자동 연결.

### 2-1. 불량코드가 두 갈래였다 (선행 조치 완료)

| 체계 | 위치 | 건수 | 등급 | 실사용 |
|---|---|---|---|---|
| ① 불량코드 마스터 | `DEFECT_CODE_MASTERS` | 12 | 있음 | **0건** |
| ② 검사 불량코드 | `COM_CODES` `CONTINUITY_DEFECT`(7) / `VISUAL_DEFECT`(8) | 15 | **없었음** | **5건(전부)** |

두 체계의 교집합이 0이었다. 의미가 겹치는데 코드값이 달라(`DIMENSION`↔`DIM`, `OTHER`↔`ETC`)
조인이 안 됐고, 정작 실데이터가 있는 ② 는 등급이 전부 NULL 이라
**부적합의 경중을 판정할 근거가 DB 에 없었다.**

NCR 이 결함구분(치명/중/경)을 요구하므로 **② 에 등급을 채웠다**
(`scripts/2026-09-15_inspect_defect_code_grade.sql`, 적용 완료).
기존 불합격 5건이 전부 등급으로 해석된다 — CRITICAL 1 / MAJOR 2 / MINOR 2.

①↔② 코드체계 통합은 검사 화면 다수가 걸려 **별건으로 둔다**(§7).

## 3. 결정 사항

### 3-1. 독립 문서로 만든다 (기존 부적합에 얹지 않는다)

부적합 발생 경로가 **원자재(IQC) / 반제품·공정(자주검사·압착) / 완제품(통전·통합·OQC) / 고객클레임**
으로 넷 이상이고 각각 다른 테이블에 쌓인다. 어느 하나에 얹으면 나머지가 비뚤어진다.
`NCR_REPORTS` 를 새로 두고, 어디서 발행하든 **출처를 참조로 붙인다**(`SOURCE_TYPE` + `SOURCE_ID`).

### 3-2. 대상구분 축을 둔다

양식의 「구분」을 확장한다 — 통계·분류가 이 축으로 갈린다.

- `RAW_MATERIAL` 원자재 · `SEMI_PRODUCT` 반제품 · `FINISHED` 완제품 · `WIP` 재공품

발견공정(`FOUND_STAGE`)은 별도 축이다: `IQC` 수입검사 / `PROCESS` 공정검사 / `FINAL` 최종검사 /
`OQC` 출하검사 / `CUSTOMER` 고객클레임. **대상과 발견 시점이 다를 수 있다**(예: 원자재 불량을
조립공정에서 발견).

### 3-3. 처리구분에 반품을 추가한다

`CONCESSION`(진행/특채) · `REPAIR`(수리) · `REWORK`(재작업) · `SCRAP`(폐기) 에
**`RETURN`(반품, Return to Vendor)** 을 더한다. 사급자재 부적합에 필요하다.
기존 `DEFECT_DISPOSITION_VALUES` 는 그대로 두고 NCR 전용 값 목록을 따로 둔다 —
기존 불량처리 흐름(재작업·수리 오더)의 의미를 바꾸지 않기 위함이다.

### 3-4. 원인·재발방지는 NCR 이 갖고, CAPA 는 필요할 때 연결한다

양식이 원인·재발방지를 NCR 본문에 요구하므로 NCR 이 직접 갖는다(인쇄 때 조인 불필요).
`CAPA_REQUESTS` 는 **정식 시정조치가 필요한 건에만** 연결한다
(`SOURCE_TYPE='NCR'`, `SOURCE_ID=NCR_NO`). 모든 부적합에 CAPA 를 강제하지 않는다 —
경미 건까지 CAPA 를 열면 실제로는 아무도 닫지 않는 문서만 쌓인다.

`CAPA_REQUESTS.SOURCE_TYPE`/`SOURCE_ID` 는 **이미 있는 필드인데 배선이 안 돼 있다.** 이번에 잇는다.

### 3-5. 결재는 경량 3인 기록으로 시작한다

양식은 발행부서(작성/검토/승인) + 처리부서(작성/검토/승인) + 품질보증팀장 3단이다.
현재 시스템에 범용 결재 엔진이 없고(`change-order`·`fai-request` 등이 각자 승인 필드를 가짐),
전면 결재 기능은 이번 범위를 크게 넘는다.

**작성자 / 처리책임자 / 최종승인자 3인 + 각 일시**를 기록하는 방식으로 시작한다.
인쇄물의 결재란은 이 3인으로 채운다. 단계를 늘리는 건 나중에 컬럼 추가로 확장 가능하다.

## 4. 데이터 모델

### `NCR_REPORTS` (신규)

| 구분 | 컬럼 | 비고 |
|---|---|---|
| 식별 | `NCR_NO` (PK) | Oracle SEQUENCE 채번 (`docs/standards/numbering-rules.md` 규칙 준수) |
| 발행 | `ISSUED_AT`, `DUE_DATE`, `ISSUE_DEPT`, `WRITER_CODE` | 회신요구일 = DUE_DATE |
| 분류 | `TARGET_TYPE`, `FOUND_STAGE` | §3-2 두 축 |
| 출처 | `SOURCE_TYPE`, `SOURCE_ID` | IQC_LOG / INSPECT_RESULT / DEFECT_LOG / COMPLAINT |
| 대상 | `ITEM_CODE`, `LOT_NO`, `SERIAL_NO`, `ORDER_NO`, `PO_NO`, `VENDOR_CODE` | 시리얼 단위 추적 |
| 수량 | `INSPECT_QTY`, `DEFECT_QTY` | |
| 부적합 | `DEFECT_CODE`, `CATEGORY_CODE`, `DEFECT_GRADE`, `DESCRIPTION`, `IMAGE_URL` | 마스터 재사용 |
| 처리 | `DISPOSITION`, `DISPOSITION_DETAIL`, `DUE_ACTION_DATE`, `RESPONSIBLE_CODE` | §3-3 5종 |
| 원인 | `CAUSE_CATEGORY`, `ROOT_CAUSE`, `PREVENTIVE_ACTION` | CAUSE_CATEGORY = 4M1E |
| 결재 | `WRITER_CODE`/`AT`, `RESPONSIBLE_CODE`/`AT`, `APPROVER_CODE`/`AT` | §3-5 |
| 종결 | `STATUS`, `CLOSED_AT`, `CLOSED_BY` | OPEN / IN_PROGRESS / CLOSED |
| 연계 | `CAPA_NO` | 정식 시정조치 연결 시 |

**4M1E** (`CAUSE_CATEGORY`): `MAN` / `MACHINE` / `METHOD` / `MEASUREMENT` / `ENVIRONMENT`
— 공통코드 그룹 `NCR_CAUSE_CATEGORY` 로 등록한다.

### 4-1. 출처별 실데이터 (발행 버튼 우선순위)

부적합이 실제로 쌓이는 곳과 그렇지 않은 곳이 갈린다. 발행 진입점은 실데이터 순으로 붙인다.

| 출처 | 실데이터 | 기록 경로 | 우선순위 |
|---|---|---|---|
| `IQC_LOGS` | 160건 | 수입검사 판정 | **1** |
| `INSPECT_RESULTS` (PASS_YN='N') | 5건 | 통전·외관·구조·통합검사 | **2** |
| `DEFECT_LOGS` | **0건** | 생산실적의 불량입력 모달 / 불량관리 화면 | 보류 |

`DEFECT_LOGS` 가 0건인 이유: 검사 불합격은 이 테이블을 만들지 않는다(두 테이블 사이에 연결이 없다).
생산실적에 불량수량을 넣어도 **불량입력 모달에서 유형을 고르지 않으면** 기록되지 않는다.
즉 현장이 수량만 입력하고 있다. NCR 을 여기에 붙이면 아무것도 안 잡히므로 발행 진입점에서 제외한다.

## 5. 화면

1. **`/quality/ncr` 목록** — 발행일 구간 기본 당일(이력성 목록 규칙), 대상구분·발견공정·등급·상태 필터.
   미완료(OPEN/IN_PROGRESS) 기본 노출.
2. **발행·편집 패널** — 우측 슬라이드, 액션 버튼 상단(프로젝트 표준).
   출처에서 넘어오면 품목·로트·수량·부적합코드가 자동으로 채워진다.
3. **인쇄** — 양식 그대로 A4 1페이지. 작업지시서·설비라벨과 같은 `window.print` + `@media print` 방식.
4. **출처 화면의 "NCR 발행" 버튼** — IQC 불합격 이력, 검사 불합격, 고객클레임에서 바로 발행.

## 6. 검증

- 백엔드 jest 전량 + FE/BE `tsc --noEmit`
- 신규 서비스 단위 테스트(채번·상태전이·처리구분 검증·CAPA 연결)
- **실 DB 스모크**: 신규 엔티티가 실제 스키마에 대해 조회되는지
  (`test:oracle-smoke` 가 엔티티 전수를 훑으므로 자동 포함)
- 실화면: IQC 불합격 1건에서 NCR 발행 → 처리구분 지정 → 종결 → 인쇄

## 7. 범위 밖 (별도 판단)

- 다단계 결재 워크플로(부서별 작성/검토/승인 3단) — §3-5 참조
- 협력사 포털 연동(반품·회신)
- NCR 통계 대시보드 — 목록 필터로 시작하고 수요 보고 판단
- **불량코드 체계 통합(①↔②)** — 검사 화면이 공통코드 대신 `DEFECT_CODE_MASTERS` 를 참조하도록
  바꾸고 기존 데이터를 매핑. 검사 화면·키오스크 다수가 걸려 NCR 과 섞으면 둘 다 위험하다.
- `DEFECT_LOGS` 0건 — 현장이 불량입력 모달을 쓰지 않는 원인 확인(교육 문제인지 UI 문제인지)
