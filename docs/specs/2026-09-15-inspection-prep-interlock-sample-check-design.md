# 통전·단자검사 준비 인터락과 양불마스터 대조 설계

- 작성일: 2026-09-15
- 대상 화면: `/inspection/result`(통전검사, `CONTINUITY`), `/inspection/terminal-result`(단자검사, `TERMINAL`)
- 관련 기준정보: `/master/inspect-aid` (검사보조구 = 양불 한도견본 마스터)
- 설계 상태: 사용자 검토 대기

## 1. 목적

통전검사·단자검사 화면에서 검사를 시작하기 전에 다음을 강제한다.

1. 작업자 선택 — 검사기에 현재 작업자 1명 이상 배정 (실적입력(가공)과 동일 방식)
2. 설비일상점검(DAILY) 완료 — 선택한 검사기(TESTER) 기준
3. 작업자설비점검(WORKER) 완료 — 작업지시 기준
4. 양불마스터(한도견본) 대조 완료 — 작업지시 × 검사기 × 조업일 × 교대 기준

검사기가 정상 동작함을 증명하지 않은 상태에서 제품 판정이 기록되는 것을 막고, 고객 감사 24P(양/불 마스터샘플) 항목에 대한 실행 증적을 남긴다.

## 2. 현재 상태 (2026-09-15 실측)

| 항목 | 현재 |
|---|---|
| 통전/단자검사 화면 | `InspectionResultWorkflow`(공통) + `InspectPanel` + `ConsumablePanel`. 검사기(TESTER) 선택은 localStorage 유지, 소모품 장착 인터락만 존재 |
| 설비점검 서버 게이트 | `ProdResultService.assertEquipInspectGate`(생산실적 전용). sys-config `EQUIP_INSPECT_INTERLOCK`, `EQUIP_INSPECT_ITEM_POOL` 매핑 유무로 적용 판단 |
| 점검 상태 판정 | `EquipInspectService.getInspectionStatus` — `alreadyInspected`(기록 존재) / `inspectPassed`(종합판정 PASS) 분리 반환. DAILY=조업일 window, WORKER=작업지시 기준 |
| 점검 UI | 키오스크 `production/input-kiosk`의 `PrepCheckBar` + `DailyInspectModal` + `WorkerInspectModal` |
| 양불마스터 | `INSPECT_AIDS` 테이블 + `/master/inspect-aid` 화면. `LIMIT_OK`(양품 한도견본) / `LIMIT_NG`(불량 한도견본) / `HOLDER`(홀더·지그), `ITEM_CODE`·`PROCESS_CODE`·`DEFECT_CODE`·`IMAGE_URL`·`VALID_FROM/TO`·`APPROVED_BY/AT`·`LOCATION`·`STATUS` 보유. JSHANES **0건** |
| 검사기 점검항목 매핑 | JSHANES TESTER 11대 중 `EQ-TEST-01` DAILY 8 / WORKER 4 등 대부분 매핑 존재 (매핑 0건 설비는 인터락 미적용) |
| 도움말 | `help/{user,operator}/ko/QC_INSPECT_AID.md` 에 "검사 화면에서 한도견본을 참조하는 연동은 후속 범위입니다" 문장 존재 |

## 3. 범위

### 3.1 포함

- 검사기 선택 옆 작업자 선택(실적입력(가공) `/production/input-kiosk`와 동일 UX·동일 공용 컴포넌트)
- 통전검사·단자검사 화면 상단 준비 체크바(4단계: 설비일상점검 / 작업자설비점검 / 양불마스터 대조 / 소모품 장착)
- 준비 미완료 시 합격(PASS)·불합격(FAIL) 버튼 비활성화
- `[양/불체크 시작]` 버튼과 견본 바코드(`AID_CODE`) 스캔 기반 대조 모달
- 설비점검 게이트의 공용 서비스 추출 및 검사 API 적용
- 양불마스터 대조 결과 기록 테이블 신설과 검사화면 내 대조 이력 조회
- `INSPECT_AIDS` 확장(검사유형·필수여부·정렬)과 `/master/inspect-aid` 화면 반영
- 서버 측 검사 등록 차단
- i18n 4개 언어, 도움말·매니페스트 갱신, ERD 갱신

### 3.2 제외

- 양불마스터 전용 신규 테이블·신규 메뉴 (기존 `INSPECT_AIDS` / `/master/inspect-aid` 사용)
- 견본 전용 바코드 컬럼 신설과 견본 라벨 출력 기능 (실물에는 기존 관례대로 `AID_CODE` 라벨을 부착한다)
- 대조 NG 시 설비 자동 INTERLOCK 또는 정비요청 자동생성
- 외관검사(`/quality/inspect`), 구조검사(`/inspection/structure`) 적용
- 검사기 측정값·판정 결과 자동 수신 (작업자가 PASS/FAIL을 수동 입력한다)
- 별도 대조 이력 메뉴 (검사화면 내 이력 모달만 제공)
- 한도견본 사진 업로드 방식 변경 (기존 multer 경로 유지)

## 4. 사용자 흐름

```text
검사기(TESTER) 선택
  → 작업자 선택 (1명 이상, 설비 현재작업자로 배정)
  → 준비 체크바 표시
     ① 설비일상점검  미완료 → 모달에서 점검 수행
     ② 작업자설비점검 미완료 → 모달에서 점검 수행 (작업자·작업지시 선택 후 가능)
     ③ 양불마스터 대조 미완료 → [양/불체크 시작] → 대조 모달
          견본 바코드(AID_CODE) 스캔 → 해당 견본 행 활성화
          양품 한도견본 투입 → 검사기 결과 PASS 여야 OK
          불량 한도견본 투입 → 검사기 결과 FAIL 이어야 OK
          스캔한 견본에 PASS/FAIL 버튼으로 결과 입력
          필수 견본 전부 입력 → 종합판정 자동 산출 → 저장(이력 보관)
     ④ 소모성 설비부품 장착 (기존)
  → 4개 모두 완료 시 PASS/FAIL 버튼 활성화
  → FG 라벨 스캔 검사 진행
```

준비가 하나라도 미완료면(작업자 미선택 포함) 합격·불합격 버튼은 비활성이며, 비활성 사유(어느 단계가 남았는지)를 버튼 툴팁과 안내문에 표시한다.

교대가 바뀌면 ③이 다시 미완료로 돌아간다. ①은 조업일 기준, ②는 작업지시 기준으로 기존 규칙을 그대로 따른다.

## 5. 판정 규칙

### 5.1 샘플별 판정

| 한도견본 유형 | 기대 결과(`EXPECTED_RESULT`) | 판정 |
|---|---|---|
| `LIMIT_OK` 양품 한도견본 | `PASS` | 검사기 결과가 PASS면 OK, FAIL이면 NG |
| `LIMIT_NG` 불량 한도견본 | `FAIL` | 검사기 결과가 FAIL이면 OK, PASS면 NG |

`HOLDER`는 대조 대상이 아니다. 사용자는 "검사기 실제 결과(PASS/FAIL)"만 입력하고, OK/NG는 서버가 기대값과 비교해 산출한다. 프론트 입력값을 그대로 신뢰하지 않는다.

### 5.2 종합판정

- 필수(`REQUIRED_YN='Y'`) 샘플이 모두 OK → `OVERALL_RESULT='PASS'`
- 하나라도 NG → `OVERALL_RESULT='NG'`, 해당 조합의 검사 등록 차단
- 재대조는 기존 기록을 갱신하지 않는다. 시도마다 **새 CHECK_NO를 생성**해 이력으로 쌓고, 유효 판정은 해당 키의 최신 기록을 쓴다 (설비점검의 재점검 패턴과 동일). 양품 합격·불량 합격 판정과 NG 판정이 모두 이력에 남는다.

### 5.3 유효기간

필수 대조 대상 중 `VALID_TO < 조업일` 또는 `STATUS <> 'ACTIVE'`인 견본이 있으면 대조 자체가 불가하며 검사도 차단한다. 오류 메시지에 해당 `AID_CODE`와 만료일, 기준정보 갱신 안내를 포함한다.

### 5.4 대조 대상이 없을 때

해당 품목·검사유형에 `REQUIRED_YN='Y'`인 유효 한도견본이 0건이면 ③은 "대상 없음"으로 완료 처리한다 (소모품 인터락의 "매핑 0건이면 통과" 관례와 동일). 인터락 자체를 켜고 끄는 스위치는 sys-config로 둔다.

## 6. 데이터 모델

### 6.1 `INSPECT_AIDS` 확장

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `INSPECT_TYPE` | `VARCHAR2(30)` NULL | 공통코드 `INSPECT_TYPE`. `CONTINUITY` / `TERMINAL`. NULL = 전 검사유형 공통 |
| `REQUIRED_YN` | `VARCHAR2(1)` DEFAULT `'Y'` | 대조 필수 여부. `'N'`은 참고용 견본 |
| `SORT_ORDER` | `NUMBER(5)` DEFAULT `0` | 대조 모달 표시 순서 |

기존 `ITEM_CODE`(품목), `DEFECT_CODE`(불량견본 대표 불량), `IMAGE_URL`(사진), `VALID_TO`(유효기간)를 그대로 사용한다. 마스터 테이블은 신설하지 않는다.

**견본 바코드**: 별도 바코드 컬럼을 만들지 않고 `AID_CODE`를 그대로 바코드 값으로 쓴다. 실물 견본에 `AID_CODE` 라벨을 부착하고 같은 코드로 등록하는 기존 운영 관례(`help/user/ko/QC_INSPECT_AID.md`)를 그대로 따른다. 대조 모달의 스캔 입력은 스캔값을 `AID_CODE`로 조회하며, 대소문자·공백을 정규화해 비교한다.

### 6.2 `INSPECT_SAMPLE_CHECKS` (신규, 대조 헤더)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `COMPANY` | `VARCHAR2(50)` | PK |
| `PLANT_CD` | `VARCHAR2(50)` | PK |
| `CHECK_NO` | `VARCHAR2(30)` | PK. `SEQ_INSPECT_SAMPLE_CHECK` 기반 채번 |
| `ORDER_NO` | `VARCHAR2(50)` | 작업지시 |
| `INSPECT_TYPE` | `VARCHAR2(30)` | `CONTINUITY` / `TERMINAL` |
| `EQUIP_CODE` | `VARCHAR2(50)` | 검사기 |
| `ITEM_CODE` | `VARCHAR2(50)` | 대조 시점 품목 |
| `WORK_DATE` | `DATE` | 조업일 (`EquipInspectService` window 기준) |
| `SHIFT_CODE` | `VARCHAR2(20)` NOT NULL | `ShiftResolver` 결과. 미판별 시 `'NONE'` |
| `OVERALL_RESULT` | `VARCHAR2(10)` | `PASS` / `NG` |
| `CHECKER_ID` | `VARCHAR2(50)` | 판정자 |
| `CHECKED_AT` | `TIMESTAMP` | 대조 시각 |
| `REMARK` | `VARCHAR2(500)` NULL | |
| `CREATED_BY/AT`, `UPDATED_BY/AT` | | `CREATED_AT`/`UPDATED_AT`은 `DEFAULT SYSTIMESTAMP` |

조회 인덱스: `IX_ISC_KEY (COMPANY, PLANT_CD, ORDER_NO, INSPECT_TYPE, EQUIP_CODE, WORK_DATE, SHIFT_CODE, CHECKED_AT DESC)`.

UNIQUE 제약은 두지 않는다. 재대조가 새 기록을 남기고 최신 1건이 유효 판정이 되기 때문이다. `EQUIP_CODE`는 판정 키에 포함한다 — 대조는 "그 검사기가 NG를 검출한다"를 증명하므로 검사기별로 성립한다.

### 6.3 `INSPECT_SAMPLE_CHECK_ITEMS` (신규, 샘플별 결과)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `COMPANY`, `PLANT_CD`, `CHECK_NO` | | PK (헤더 FK) |
| `SEQ_NO` | `NUMBER(5)` | PK |
| `AID_CODE` | `VARCHAR2(50)` | `INSPECT_AIDS.AID_CODE` |
| `AID_TYPE` | `VARCHAR2(30)` | 대조 시점 스냅샷 |
| `EXPECTED_RESULT` | `VARCHAR2(10)` | `PASS` / `FAIL` |
| `ACTUAL_RESULT` | `VARCHAR2(10)` | 검사기 실제 결과 |
| `RESULT` | `VARCHAR2(10)` | `OK` / `NG` (서버 산출) |
| `SCANNED_AT` | `TIMESTAMP` NULL | 견본 바코드 스캔 시각 (대조 증적) |
| `REMARK` | `VARCHAR2(500)` NULL | NG 사유 |
| `CREATED_BY/AT` | | `DEFAULT SYSTIMESTAMP` |

TypeORM 엔티티는 nullable union 컬럼에 `@Column type` 명시, NUMBER 컬럼은 프로젝트 규칙을 따른다.

## 7. 서버 설계

### 7.1 설비점검 게이트 공용화

현재 `ProdResultService.assertEquipInspectGate`에만 있는 로직을 `EquipInspectGateService`(equipment 모듈)로 추출한다.

```text
EquipInspectGateService
  getGateStatus({ equipCode, orderNo, scope }, tenant)  → { dailyRequired, dailyDone, workerRequired, workerDone, messages }
  assertGate(...)                                        → 미완료·NG면 BadRequestException
```

- `ProdResultService.assertEquipInspectGate`는 이 서비스에 위임한다. 규칙 정의는 한 곳, 생산실적과 검사가 같은 함수를 호출한다.
- sys-config 스코프 키에 검사용을 추가한다: `INSPECT_DAILY_INSPECT_REQUIRED`, `INSPECT_WORKER_INSPECT_REQUIRED`. 기존 `EQUIP_INSPECT_INTERLOCK`는 전역 스위치로 그대로 작동한다.
- 기존 동작(매핑 0건이면 통과, `inspectPassed`가 아니면 차단, WORKER는 orderNo 필수)은 변경하지 않는다.

### 7.2 양불마스터 대조 서비스

`InspectSampleCheckService` (quality/continuity-inspect 하위).

- `getCandidates(itemCode, inspectType, tenant)` — `INSPECT_AIDS`에서 `AID_TYPE IN ('LIMIT_OK','LIMIT_NG')`, 품목 일치 또는 품목 NULL(공용), 검사유형 일치 또는 NULL, `USE_YN='Y'` 인 목록. 만료·비활성 여부와 `EXPECTED_RESULT`를 함께 내린다.
- `getStatus({ orderNo, inspectType, equipCode }, tenant)` — 조업일·교대 산출 후 최신 기록 1건으로 `done` / `overallResult` / `checkedAt` / `blockedReason` 반환.
- `create(dto, user, tenant)` — 후보 목록을 서버에서 다시 조회해 필수 항목 누락·만료를 검증하고, 샘플별 `RESULT`를 기대값 비교로 산출한 뒤 헤더+아이템을 한 트랜잭션으로 저장한다.

### 7.3 작업자와 검사자 기록

- 작업자 배정은 기존 `PATCH /equipment/equips/{equipCode}/workers`를 그대로 쓴다. 새 API를 만들지 않는다.
- 검사 등록 시 `INSPECT_RESULTS.INSPECTOR_ID`에 **대표 작업자(선택 목록의 첫 번째)** 를 기록한다. 현재 화면은 검사자를 전혀 보내지 않으므로 이 값이 채워지는 것 자체가 개선이다.
- 양불 대조의 `CHECKER_ID`도 같은 대표 작업자를 쓰고, 로그인 계정은 `CREATED_BY`로 남긴다. 두 값이 다를 수 있다(계정 공용 단말).
- 작업자 목록은 서버가 검사기의 현재 작업자에서 다시 읽어 검증한다. 요청 본문의 작업자를 그대로 신뢰하지 않는다.

### 7.4 API

```text
GET  /quality/continuity-inspect/prep-status?orderNo&inspectType&equipCode
GET  /quality/continuity-inspect/sample-check/candidates?itemCode&inspectType
POST /quality/continuity-inspect/sample-check
GET  /quality/continuity-inspect/sample-check/history?orderNo&inspectType
```

- `prep-status`는 설비점검 게이트 상태 + 양불대조 상태 + 소모품 장착 상태를 한 응답으로 합친다. 프론트가 세 곳을 따로 물어 상태가 어긋나지 않게 한다.
- `POST /quality/continuity-inspect/inspect`는 등록 직전 `EquipInspectGateService.assertGate`와 `InspectSampleCheckService.assertReady`를 호출한다. 화면 우회 호출도 동일하게 막힌다.
- 회사·공장·작성자는 요청 본문이 아니라 서버 컨텍스트에서 정한다.

### 7.5 오류 메시지

| 상황 | 메시지 |
|---|---|
| 작업자 미선택 | `작업자를 1명 이상 선택해야 검사를 등록할 수 있습니다: {equipCode}` |
| 일상점검 미완료 | `설비 일상점검을 완료해야 검사를 등록할 수 있습니다: {equipCode}` |
| 일상점검 NG | `설비 일상점검 종합판정이 불합격({result})입니다 — 조치 후 재점검하세요.` |
| 작업자점검 미완료 | `작업자 설비점검을 완료해야 검사를 등록할 수 있습니다: {equipCode} (작업지시 {orderNo})` |
| 대조 미완료 | `양불마스터 대조를 완료해야 검사를 등록할 수 있습니다: {equipCode} ({workDate} {shiftCode})` |
| 대조 NG | `양불마스터 대조 결과가 불합격입니다 — 검사기 점검 후 재대조하세요: {aidCode}` |
| 견본 만료 | `한도견본 유효기간이 만료되어 대조할 수 없습니다: {aidCode} (만료 {validTo})` |

생산실적 게이트와 문구 구조를 맞춘다.

## 8. 프론트 설계

### 8.1 파일 구성

```text
inspection/result/
  components/
    InspectionResultWorkflow.tsx   조립만 (기존, 작업자·prep 상태 배선 추가)
    InspectStationBar.tsx          신규 — 검사기 + 작업자 선택 바
    InspectPrepCheckBar.tsx        신규 — 4단계 체크바 + [양/불체크 시작] 버튼
    SampleCheckModal.tsx           신규 — 견본 바코드 스캔 + 양불 대조 입력
    SampleCheckHistoryModal.tsx    신규 — 대조 이력 조회
    InspectPanel.tsx               기존 — prep 단일 prop 수신
  hooks/
    useInspectPrepStatus.ts        신규 — prep-status 조회·갱신·모달 상태
```

- 설비일상점검·작업자설비점검 모달은 키오스크의 `DailyInspectModal` / `WorkerInspectModal`을 `components/shared` 또는 공용 위치로 옮겨 두 화면이 같은 컴포넌트를 쓴다. 복제하지 않는다.
- `InspectPanel`에 boolean을 3개 더 추가하지 않는다. `useInspectPrepStatus`가 소모품 장착까지 포함한 단일 `prep` 객체를 반환하고, `InspectPanel`은 그 하나만 받는다. 기존 `consumablesReady` / `unmountedConsumCount` prop은 이 객체로 흡수한다.
- 체크바는 키오스크 `PrepCheckBar`와 같은 4칸 구조·같은 단계 표기를 쓰되, 파스텔 배경 금지 규칙에 따라 기존 키오스크 스타일을 그대로 따르지 않고 프로젝트 디자인 표준을 확인해 맞춘다.

### 8.2 작업자 선택

실적입력(가공) `/production/input-kiosk`의 방식을 그대로 따른다. 새 UI를 설계하지 않는다.

- 공용 `@/components/worker/WorkerSelectModal`을 그대로 쓴다.
- 검사기 선택 바 오른쪽에 작업자 칩 목록과 `[작업자 추가]` 버튼을 둔다. 칩의 X로 제외한다.
- 선택 결과는 `PATCH /equipment/equips/{equipCode}/workers`로 검사기의 현재 작업자로 배정한다. 저장 실패 시 이전 상태로 되돌리고 토스트로 알린다 (키오스크와 동일).
- 작업자 0명이면 키오스크와 같이 왼쪽 굵은 빨강 보더와 경고 문구를 표시하고, ② 작업자설비점검 버튼과 합격·불합격 버튼을 비활성한다. 파스텔 배경은 쓰지 않는다.
- 화면 재진입 시 검사기의 현재 작업자를 조회해 복원한다 (검사기 선택은 기존 localStorage 유지 로직 그대로).

### 8.3 대조 모달

- 체크바 ③ 칸에 `[양/불체크 시작]` 버튼을 둔다. 검사기 미선택·작업지시 미선택이면 비활성이며 사유를 표시한다.
- 후보 샘플을 `SORT_ORDER`, `AID_TYPE` 순으로 나열하고 사진 썸네일·유효기간 배지·기대결과(`양품견본=합격이어야 함` / `불량견본=불합격이어야 함`)를 표시한다.
- 상단에 견본 바코드 스캔 입력을 둔다. `components/shared/BarcodeScanInput`을 쓰고 `maintainFocus`·`refocusAfterScan`로 연속 스캔을 유지한다. 일반 `Input` + `onKeyDown Enter` 조합은 쓰지 않는다.
- 스캔값이 후보 목록의 `AID_CODE`와 일치하면 그 행이 활성화되고 `PASS` / `FAIL` 2버튼이 열린다. 스캔하지 않은 행은 결과 입력이 불가하다.
- 스캔값이 후보에 없으면(다른 품목·다른 검사유형·미등록 견본) 사유를 표시하고 입력을 거부한다.
- OK/NG 판정은 저장 후 서버 응답으로 표시한다. 프론트는 기대값 비교를 판정 근거로 쓰지 않는다.
- 만료 견본이 있으면 저장 버튼을 막고 기준정보 화면 링크를 안내한다.
- `alert`/`confirm` 사용 금지, 모달 컴포넌트로 처리한다.

### 8.4 대조 이력

- 체크바 ③ 칸 또는 모달 상단에서 이력 모달을 연다. 별도 메뉴는 만들지 않는다.
- 기본 조회 조건은 현재 작업지시 + 검사유형이며, 조업일·교대·검사기·종합판정·판정자·대조시각을 목록으로 보여준다.
- 행을 펼치면 샘플별 `AID_CODE`, 유형, 기대결과, 실제결과, OK/NG, 비고를 표시한다.
- 종합판정은 공통 `StatusBadge`로 표시하고 라벨은 `comCode` 단일 출처를 쓴다.
- 기록은 삭제·수정하지 않는다. 재대조는 새 기록으로 쌓이고 이력에 모두 남는다.

### 8.5 기준정보 화면

`/master/inspect-aid`의 폼·그리드에 `INSPECT_TYPE`, `REQUIRED_YN`, `SORT_ORDER`를 추가한다. `INSPECT_TYPE`은 `ComCodeSelect`, 목록 표시는 `ComCodeBadge`를 쓴다. 자유 입력을 만들지 않는다.

### 8.6 i18n

`ko`, `en`, `zh`, `vi` 4개 파일에 체크바·모달·기준정보 신규 필드 키를 동시에 추가한다. 공통코드 라벨은 `comCode.INSPECT_TYPE.{value}` 단일 출처를 쓴다. JSON에 BOM을 넣지 않고 Grep으로 4파일 존재를 검증한다.

## 9. 검증

### 9.1 Backend

- `EquipInspectGateService`: 매핑 0건 통과 / DAILY 미완료 차단 / DAILY NG 차단 / WORKER orderNo 누락 / sys-config `N` 시 통과
- `ProdResultService`가 위임 후에도 기존 spec(`prod-result.service.spec.ts`의 인터락 케이스, `subprocess-kitting.service.spec.ts`)을 그대로 통과
- `InspectSampleCheckService`: 기대값 비교 산출(LIMIT_OK+FAIL→NG, LIMIT_NG+PASS→NG) / 필수 누락 거부 / 후보에 없는 `AID_CODE` 거부 / 만료 견본 거부 / 후보 0건 통과 / 교대 변경 시 미완료 복귀 / 재대조 시 새 기록 생성과 최신 1건 유효 / 이력 조회가 이전 기록을 모두 반환 / tenant 격리
- `POST /inspect` 게이트 통합 차단

### 9.2 Frontend

- `inspection/result/` 구조 테스트: 작업자 미선택·prep 미완료 시 PASS/FAIL 버튼 `disabled`, 작업자 선택이 공용 `WorkerSelectModal`을 사용, 대조 모달이 `BarcodeScanInput`을 사용 (기존 `.structure.test.mjs` 관례 사용)
- `pnpm.cmd run typecheck:frontend`, `typecheck:backend`

### 9.3 DB

- DDL은 `oracle_connector.py --site JSHANES --execute-file`로 적용하고 pre/post 조회 결과를 기록한다.
- 적용 후 `ORACLE_SITE=JSHANES python tools/generate_db_schema_doc.py`로 ERD를 갱신한다.
- `INSPECT_AIDS` 컬럼 추가 후 의존 PL/SQL이 INVALID 되면 `ALTER ... COMPILE`로 정리한다.

### 9.4 실사용 시나리오 (포트 3002)

1. 통전검사 화면에서 검사기 선택 → 작업자 미선택 경고, 합격·불합격 버튼 비활성 확인
2. 작업자 추가 → 검사기 현재작업자로 저장, 새로고침 후 복원 확인
3. 설비일상점검 수행 → ① 완료
4. 작업자설비점검 수행 → ② 완료
5. `[양/불체크 시작]` → 견본 바코드 스캔 → 해당 행만 입력 가능 확인, 미등록 코드 스캔 시 거부 확인
6. 불량 한도견본에 PASS 입력 → NG 판정, 검사 차단 확인
7. 재대조 정상 입력(양품=합격, 불량=불합격) → ③ 완료, 합격·불합격 버튼 활성화
8. 이력 모달에서 NG 시도와 재대조 기록이 모두 조회되는지 확인
9. 만료 견본 등록 후 대조·검사 차단 확인
10. 단자검사 화면에서 동일 동작 확인

### 9.5 문서

- `help/{user,operator}/ko/QC_INSPECT_AID.md`의 "검사 화면 연동은 후속 범위" 문장을 갱신하고, 통전·단자검사 도움말에 체크바·대조 절차를 추가한다.
- `manifest.json`과 `node tools/help-frontmatter-audit.mjs` 통과 확인

## 10. 결정과 가정

- 양불마스터 저장소는 기존 `INSPECT_AIDS`를 쓴다. 신규 마스터 테이블·신규 기준정보 메뉴는 만들지 않는다 (사용자 확인).
- 대조 단위는 작업지시 × 검사기 × 조업일 × 교대 1회다.
- 대조 종합판정 NG는 검사를 차단한다. 설비 자동 INTERLOCK·정비요청 자동생성은 범위 밖이다 (사용자가 선택하지 않음).
- 만료 견본은 대조 불가이며 검사를 차단한다.
- "작업자일상점검"은 기존 `WORKER`(작업자설비점검)로 해석한다. 설비와 무관한 작업자 개인 점검이 필요하면 별도 설계가 필요하다.
- 적용 범위는 통전검사·단자검사 2개 화면이다.
- 작업자 선택은 실적입력(가공) `/production/input-kiosk`와 같은 공용 컴포넌트·같은 배정 API를 쓴다. 검사 전용 작업자 UI를 새로 만들지 않는다 (사용자 지시).
- 작업자가 여러 명이면 대표 작업자(첫 번째)를 검사자·대조 판정자로 기록한다. 검사 1건에 복수 작업자를 저장하는 구조는 범위 밖이다.
- 견본 바코드는 `AID_CODE` 자체를 쓴다. 전용 바코드 컬럼·채번·라벨 출력은 만들지 않는다 (사용자 확인).
- 대조 결과는 작업자가 검사기 화면을 보고 PASS/FAIL을 수동 입력한다. 검사기 자동 수신은 범위 밖이다.
- 대조 이력은 검사화면 내 모달로만 조회한다. 별도 품질 메뉴는 만들지 않는다.

## 11. 완료 기준

- 통전·단자검사에서 작업자 선택과 4단계 준비가 끝나기 전에는 합격·불합격 버튼이 비활성이고, API 직접 호출도 동일하게 막힌다.
- 작업자 선택·표시·배정이 실적입력(가공)과 동일하게 동작한다.
- `[양/불체크 시작]` → 견본 바코드 스캔 → PASS/FAIL 입력 흐름으로 대조를 수행할 수 있다.
- 양품 합격·불량 합격·NG 판정이 샘플별 OK/NG와 판정자·시각으로 DB 이력에 남고 검사화면에서 조회된다.
- 설비점검 게이트가 생산실적과 검사에서 같은 함수로 판정된다.
- 기준정보에서 품목·검사유형별 대조 대상과 필수여부를 관리할 수 있다.
- Backend focused test, FE/BE typecheck, JSHANES pre/post-check, ERD 갱신, 포트 3002 시나리오, 도움말 갱신이 모두 완료된다.
