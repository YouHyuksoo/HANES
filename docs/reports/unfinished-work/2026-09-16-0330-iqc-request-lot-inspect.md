# 미완료 작업 기록: 의뢰 LOT의 IQC 검사 연결 (IQC_INSPECT_LOT_MODE)

- 작성시각: 2026-09-16 03:30 KST
- 작성자: claude
- 작업 범위: `/material/iqc` 수입검사 화면과 `material/iqc-history` API, `IQC_INSPECT_LOT_MODE` 분기
- 현재 상태: 검증대기

## 완료한 것

앞선 작업에서 의뢰 LOT 화면의 AQL 우회 판정을 제거했으므로, 확정된 의뢰 LOT이 실제로 검사될 경로가 필요했다.
`SYS_CONFIGS.IQC_INSPECT_LOT_MODE`가 DB에만 있고 코드에서 읽는 곳이 없던 것을 실제 분기로 구현했다.

### 1. 검사대기 목록에 의뢰 LOT 묶음 행 노출

`findPendingArrivals`가 `IQC_INSPECT_LOT_MODE`를 읽는다.

- `ARRIVAL`(기본값): 기존 동작 그대로. 변경 없음
- `REQUEST`: 아래 두 가지를 합쳐서 내려준다
  - `REQUESTED` 상태 의뢰 LOT 1건 = 1행 (`findPendingRequestLots`)
  - 의뢰에 담기지 않은 입하 행은 기존처럼 입하번호+품목 단위 행

의뢰에 담긴 입하 행은 개별 행에서 제외된다. 같은 `ARRIVAL_NO`라도 담긴 `SEQ` 행만 빠진다.

### 2. AQL 판정 경로 일원화

`createArrivalResult`의 판정 본문을 `judgeLotsWithAql()` private 코어로 추출하고, 입하단위와 의뢰 LOT이 같은 코어를 쓴다.

- 두 경로 모두 `aqlService.resolveIqcPolicyByItem()`을 호출하고 `finalResult = aqlPolicy.result`로 **서버가 프론트 판정을 재정의**한다
- `IQC_LOGS`에 AQL 수준/모드/시료수/Ac/Re/판정근거가 동일하게 적재된다
- 차이는 두 가지뿐이다. 판정 대상이 `(ARRIVAL_NO, ARRIVAL_SEQ)` 행으로 한정되고, 모집단 수량이 의뢰 확정 시 합의된 `LOT_QTY`다
- 의뢰 LOT 판정 로그에는 `[IQL:<의뢰번호>]` 접두어가 붙는다

신규 엔드포인트: `POST /material/iqc-history/request-lot/:requestNo`

### 3. AQL 우회 죽은 코드 제거

`applyIqcVerdictToArrivals()`를 삭제했다. 이 메서드는 `resolveIqcPolicyByItem()`을 부르지 않고 프론트가 보낸 PASS/FAIL을 그대로 확정하던 경로다. 앞선 작업에서 유일한 호출부가 사라져 죽은 코드였고, 남겨두면 다시 쓰일 위험이 있었다.

### 4. 검사대기 시리얼 조회 연결

`GET /material/iqc-history/pending-serials`에 `requestNo` 선택 파라미터를 추가했다. 주면 의뢰에 담긴 `(ARRIVAL_NO, ARRIVAL_SEQ)` 행의 시리얼만 돌려준다. 입하번호만으로는 모집단을 특정할 수 없기 때문이다.

### 5. 화면 표시

`IqcTable`의 입하번호 컬럼에 의뢰 LOT 행이면 `의뢰LOT` 배지를 붙인다. `IqcItem.requestNo`로 구분한다.

## 미완료 / 남은 것

> 2026-09-16 04:10: FAIL 경로 검증은 완료되었다. 아래 `검증 상태` 절을 보라.

### AQL 예상 시료수 표시가 실제 판정값과 다르다

의뢰 LOT 구성 화면(`/quality/iqc-request-lot`)의 `예상 시료수`는 모집단수량과 같은 값을 보여준다(모집단 3,000 → 3000).
반면 실제 판정에서 `IQC_LOGS.AQL_SAMPLE_QTY`는 **125**로 기록됐다(검사수준 II, NORMAL).

- 구성 화면은 `GET /quality/aql/resolve-iqc-items`를 쓰고, 판정은 `aqlService.resolveIqcPolicyByItem()`을 쓴다
- 두 경로의 시료수 산출이 다르게 나오는 원인을 확인해야 한다
- 현재 구성 화면 값은 참고 표시일 뿐 판정에 영향이 없지만, 담당자에게 잘못된 기대를 준다

### REQUEST 모드는 현재 비활성이다

검증을 위해 `IQC_INSPECT_LOT_MODE`를 `REQUEST`로 바꿨다가 **검증 후 `ARRIVAL`로 원복**했다. 운영 적용 시점은 사용자가 정해야 한다.

## 변경 파일

- `apps/backend/src/modules/material/services/iqc-history.service.ts`: `IqcRequestLot`/`IqcRequestLotLine` 리포지토리 주입, `judgeLotsWithAql()` 코어 추출, `createRequestLotResult()` 추가, `findPendingRequestLots()` 추가, `findPendingArrivals()` REQUEST 분기, `findPendingSerials()` requestNo 지원, `applyIqcVerdictToArrivals()` 삭제
- `apps/backend/src/modules/material/controllers/iqc-history.controller.ts`: `POST request-lot/:requestNo` 추가, `pending-serials`에 requestNo 전달
- `apps/backend/src/modules/material/dto/iqc-history.dto.ts`: `PendingSerialsQueryDto.requestNo` 추가
- `apps/backend/src/modules/material/services/iqc-history.service.spec.ts`: 신규 리포지토리 mock provider 2건 추가, LOT 갱신 단언을 matUid 기준으로 조정
- `apps/frontend/src/hooks/material/useIqcData.ts`: `IqcItem.requestNo` 추가, 제출 엔드포인트 분기
- `apps/frontend/src/components/material/IqcModal.tsx`: 시리얼 조회에 requestNo 전달
- `apps/frontend/src/components/material/IqcTable.tsx`: 의뢰LOT 배지

DB 스키마 변경 없음.

## 검증 상태

- 실행함: backend tsc 0 error, frontend tsc 0 error
- 실행함: `jest src/modules/material src/shared/numbering src/architecture` 645건 중 644 pass
- 실행함: JSHANES에서 `IQC_INSPECT_LOT_MODE='REQUEST'`로 전환 후 브라우저 전 구간 검증
  - 품목 `HKEAN1W002FA`의 입하 50행 중 3행(#1, #3, #50)으로 의뢰 `IQL20260916-0003`(모집단 3,000) 생성
  - `/material/iqc` 목록에 `의뢰LOT IQL20260916-0003` 행이 시리얼수 3 / 3,000 EA로 표시
  - 같은 입하번호 `R26091300001` 개별 행은 50 → **47행 / 47,000 EA**로 줄었다. 담긴 3행만 제외된 것을 확인
  - 검사 모달에서 `검사대기 시리얼 조회 (3)` → 의뢰한 행의 시리얼 `VH1-RM260913-00001/00003/00050` 정확히 3건
  - 검사항목 5건 × 시리얼 3건 전부 PASS 등록 → 의뢰 LOT 행이 목록에서 사라짐
  - DB 결과: `IQC_REQUEST_LOTS.STATUS=PASS`, `SAMPLE_QTY=125`
  - `MAT_LOTS` 3 PASS / 47 PENDING, `MAT_ARRIVALS` 3 PASS / 47 PENDING — 의뢰한 행만 판정됨
  - `IQC_LOGS` 1건: `RESULT=PASS`, `LOT_QTY=3000`, `AQL_SAMPLE_QTY=125`, `LEVEL=II`, `MODE=NORMAL`, `AQL_MAJOR_CODE=AQL-I-0.01`, `AC/RE=0/1`, `JUDGE_REASON='검사항목별 AQL 기준 합격'`, `REMARK='[IQL:IQL20260916-0003]'`
- 실행함: 검증 데이터 전량 원복. 의뢰 헤더/라인 0건, IQC_LOGS 해당 1건 삭제, `MAT_LOTS`/`MAT_ARRIVALS` 50건 PENDING 복구, `IQC_INSPECT_LOT_MODE='ARRIVAL'` 원복

### FAIL 경로 검증 (2026-09-16 04:10 추가)

`IQC_FAIL_DEFECT_MOVE_MODE` 두 값을 모두 확인했다. 두 케이스 모두 품목 `HKEAN1W002FA`, 입하 50행 중 3행(#1, #3, #50), 모집단 3,000으로 구성했다.

**공통**

- 검사항목 1번을 FAIL로 한 시리얼에만 표시하면 모달이 `예상 LOT 판정: FAIL — IQC-TEST MAJOR 불량 1건이 Ac 0 초과`를 보여준다
- FAIL은 불량코드와 불량수가 필수다. 둘 중 하나라도 비면 등록 버튼이 disabled이고 `FAIL 판정에는 불량코드와 불량수가 필요합니다.` 경고가 뜨다. 정상 동작이다
- 등록 후 `IQC_REQUEST_LOTS.STATUS=FAIL`, `SAMPLE_QTY=125`
- `MAT_LOTS` 3 FAIL / 47 PENDING, `MAT_ARRIVALS` 3 FAIL / 47 PENDING — 의뢰한 행만 판정된다
- `IQC_LOGS` 1건: `RESULT=FAIL`, `LOT_QTY=3000`, `AQL_SAMPLE_QTY=125`, `AC/RE=0/1`, `DEFECT_MAJOR=1`, `JUDGE_REASON='IQC-TEST MAJOR 불량 1건이 Ac 0 초과'`, `REMARK='[IQL:<의뢰번호>]'`

**Test A — `IQC_FAIL_DEFECT_MOVE_MODE=MANUAL` (운영 기본값), 의뢰 `IQL20260916-0004`**

- 재고 이동 없음. `STOCK_TRANSACTIONS` `REF_TYPE='IQC_FAIL'` 18건 그대로 유지
- 대상 3건 입하재고 `W001 / QTY 1000 / AVAILABLE` 유지
- 설계대로 자재관리 > IQC불합격자재 불량창고입고 화면에서 수동 처리할 대상으로 남는다

**Test B — `IQC_FAIL_DEFECT_MOVE_MODE=AUTO`, 의뢰 `IQL20260916-0005`**

- `STOCK_TRANSACTIONS` `REF_TYPE='IQC_FAIL'` 18 → **21건**. 정확히 3건만 증가
- 생성된 3건은 의뢰한 시리얼 `VH1-RM260913-00001/00003/00050`, 각 `W001 → DEFECT`, QTY 1000, `비고='IQC 불합격 자동이동 (불량창고)'`
- 입하재고 3건 `QTY=0 / AVAILABLE_QTY=0 / STATUS=DEPLETED`
- 불량창고 `MAT_STOCKS` 3건 `DEFECT / 1000`
- 나머지 47건 입하재고는 그대로다. **같은 ARRIVAL_NO여도 의뢰에 담긴 행만 이동한다**

**원복**

두 케이스 데이터를 전량 되돌렸다. 의뢰 헤더/라인 0건, `MAT_LOTS`·`MAT_ARRIVALS` 50건 PENDING, `IQC_FAIL` 트랜잭션 18건 복귀, 입하재고 3건 `W001/1000/AVAILABLE` 복구, 불량창고 `MAT_STOCKS` 행 삭제, `IQC_FAIL_DEFECT_MOVE_MODE='MANUAL'`·`IQC_INSPECT_LOT_MODE='ARRIVAL'` 원복까지 확인했다.

- 실행 못함: 파괴검사 시료 자동출고(`IQC_SAMPLE_ISSUE_MODE=AUTO_ISSUE`) 경로. 현재 운영값은 `LOSS_ALLOW`라 동작하지 않는다

## 기존 실패 (이번 변경과 무관)

`src/architecture/module-boundary.spec.ts`의 `does not add new simple runtime any escape hatches` 1건.
offenders는 `modules/quality/control-plan/services/` 4파일이며 `git status`상 미수정, 커밋 `9c250304`에서 들어온 기존 위반이다.

## 중단 사유

- 운영 모드 전환(`REQUEST`) 시점은 사용자 결정 사항이라 `ARRIVAL`로 원복해 두었다.

## 다음 작업자가 바로 할 일

1. AQL 예상 시료수 불일치(`resolve-iqc-items` vs `resolveIqcPolicyByItem`) 원인을 확인한다.
2. REQUEST 모드 FAIL 경로를 실데이터로 검증한다. 불량창고 이동이 의뢰에 담긴 행만 대상으로 도는지 본다.
3. 운영 적용을 결정하면 `IQC_INSPECT_LOT_MODE`를 `REQUEST`로 바꾼다. 시스템설정 화면에서 변경 가능하다.

## 주의사항

- **TypeORM QueryBuilder의 조인 조건 문자열에 줄바꿈을 넣지 말 것.** 줄바꿈이 있으면 `alias.프로퍼티` 치환이 안 돼 `ORA-00904: "LN"."ITEMCODE"` 같은 오류가 난다. 이번에 실제로 겪었고 소스에 주석으로 남겼다.
- **외부 alias를 참조하는 상관 서브쿼리를 TypeORM `subQuery()`로 만들지 말 것.** 같은 이유로 alias가 안 풀린다. 좌변만 엔티티 속성으로 두고 서브쿼리는 외부 참조 없는 독립 raw SQL로 작성했다.
- `judgeLotsWithAql()`는 입하단위와 의뢰 LOT 공용 코어다. 한쪽만 고치면 두 경로가 갈라진다.
- `applyIqcVerdictToArrivals()`를 되살리지 말 것. AQL을 우회한다.
- 품목 `1SH21A7A09`은 `MAT_ARRIVALS`는 PENDING인데 `MAT_LOTS`는 CANCELED다. 의뢰 구성은 되지만 검사 대상 시리얼이 없어 IQC 목록에 뜨지 않는다. 테스트에 쓰지 말 것. 데이터 정합성 문제로 별도 확인이 필요하다.

---

## 프로세스 유기성 점검 (2026-09-16, 코드 정독 + JSHANES 실측)

브라우저 실행 없이 소스 정독과 DB 실측으로만 확인했다. 전 세션의 브라우저 검증 결과는 그대로 유효하다고 보고 그 위에 얹는다.

### A. ARRIVAL 모드에서 의뢰 화면이 막다른 길이다 (1급)

`IqcRequestLotService.create()`는 `IQC_INSPECT_LOT_MODE`를 읽지 않는다(소스 전수 확인, 참조 0건).
현재 운영값은 `ARRIVAL`(JSHANES 실측: COMPANY=40 / PLANT_CD=1000 / 'ARRIVAL')이다. 따라서:

- 담당자가 `/quality/iqc-request-lot`에서 의뢰를 확정해도 `/material/iqc`에는 아무 행도 뜨지 않는다
- 같은 입하 행이 입하단위 행으로 그대로 노출되어 의뢰와 무관하게 검사·판정된다
- `createArrivalResult` 경로는 `IQC_REQUEST_LOTS`를 전혀 건드리지 않는다(`iqcRequestLotRepository` 참조는 `findPendingSerials`/`createRequestLotResult`/`findPendingRequestLots`뿐)
- 결과적으로 `MAT_LOTS`/`MAT_ARRIVALS`는 PASS/FAIL인데 의뢰 헤더는 `REQUESTED`로 영구 잔존한다. 취소밖에 길이 없다

화면에 모드 경고나 생성 차단이 없다. 지금 상태의 가장 큰 구멍이다.

### B. 모집단 수량 산출 기준이 두 갈래다 (1급)

| 값 | 산출식 | 쓰이는 곳 |
|---|---|---|
| `IQC_REQUEST_LOTS.LOT_QTY` | `SUM(MAT_ARRIVALS.QTY)` | AQL 모집단 (`lotQtyOverride`) |
| 검사대기 목록 `totalQty` | `SUM(MAT_LOTS.INIT_QTY)` | 화면 표시 수량 |

JSHANES 실측: `(ARRIVAL_NO, SEQ)` 조인 409건 중 **18건**에서 두 값이 다르다. 입하 행 1건에 시리얼 여러 건이 달리고 그 합이 입하수량과 어긋나는 1:N 케이스다.

예) `R26090900020 / SEQ 3 / VSFT1-201` — 입하수량 1,000 vs 시리얼 2건 합 3,000
예) `R26070300018 / SEQ 1 / 6TPP210190` — 8,000,000 vs 5건 합 23,999,990

입하단위 경로는 표시와 판정이 모두 `SUM(INIT_QTY)`라 일치하지만, 의뢰 LOT 경로만 갈라진다. 화면에 3,000 EA로 보이는 LOT을 AQL은 1,000 모집단으로 샘플수를 잡을 수 있다.

### C. 예상 시료수 불일치 — 원인 확정, 그리고 범위가 더 넓다 (1급)

**`0125` 기록의 "AQL 규칙이 없어 전수검사로 폴백" 추정은 틀렸다.** 실제 원인은 다르다.

JSHANES `IQC_PART_SPEC_ITEMS` 실측: `HKEAN1W002FA`, `1SH21A7A09` 모두 `SEQ 101 / THN-A50-G01`이 `INSPECTION_TYPE='FULL'`, `SAMPLE_METHOD='FIXED'`다.

`aql.service.ts:522-527`에서 FULL 항목은 `requiredQty = lotQty`이고, `itemInspectedCounts`가 없으면 `inspectedQty = requiredQty`로 폴백해 `sampleQty = max(..., lotQty)`가 된다.
판정 경로는 `parseDestructive(dto.details)`로 실제 검사수량을 넘기므로 AQL 규칙값(125)이 남지만, **미리보기 경로는 `itemInspectedCounts`를 아예 넘기지 않는다.**

프론트 호출부 전수 확인 결과 `itemInspectedCounts`를 넘기는 곳이 **한 곳도 없다.**

- `hooks/material/useIqcRequestLot.ts:113` (의뢰 LOT 구성)
- `components/material/IqcModal.tsx:521` (IQC 검사 모달 예상 판정)
- `components/material/IqcRequestPrintModal.tsx:110` (검사의뢰서 인쇄)
- `app/(authenticated)/master/iqc-part-spec/page.tsx:131` (품목 검사규격 AQL 요약)

즉 FULL/파괴 검사항목이 하나라도 있는 품목은 **네 화면 모두** 예상 시료수가 모집단수량으로 뜬다. 의뢰 화면만의 문제가 아니다. 인쇄되는 검사의뢰서에도 잘못된 시료수가 찍힌다.

### D. AQL이 실제로 적용되는 항목이 1건뿐이다 (확인 필요)

`HKEAN1W002FA`의 활성 검사항목 6건 중 `AQL` 값이 있는 것은 `SEQ 1 / IQC-TEST`(AQL 0.01, 수준 I) 하나다.
나머지 `THN-A50-H01/H02/V01/V02`는 등급(MAJOR/CRITICAL)만 있고 `AQL`이 `NULL`이라 `aql.service.ts:548`의 "AQL 미설정 → 불량 1건이면 FAIL" 제로톨러런스 분기로 떨어진다. `1SH21A7A09`도 9건 중 2건만 AQL이 있다.

동작 자체는 설계된 보수적 폴백이지만, 담당자 입장에서는 **AQL 샘플링 검사로 보이는데 실제로는 대부분 항목이 무관용 판정**이다. THN 표준 관리계획 시드가 AQL 값을 안 채운 것으로 보인다. 기준정보 쪽 확인이 필요하다.

### E. 의뢰↔검사이력 연결이 문자열뿐이다 (2급)

`IQC_LOGS`에 `REQUEST_NO` 계열 컬럼이 없다(실측 0건). 연결은 `REMARK`의 `[IQL:...]` 접두어 하나다.
역추적이 LIKE 검색으로만 가능하고 FK 무결성이 없다. 의뢰 LOT 기준 검사이력 조회 화면을 만들려면 먼저 컬럼이 필요하다.

### F. `lineRole`(시료/대표)이 하류에서 소비되지 않는다 (2급)

`createRequestLotResult`에서 `sampleLine`은 `representativeArrivalNo`(로그 표시용 대표 입하번호)만 정한다.
검사 대상 시리얼도, 시료수도 역할과 무관하다. 화면은 담당자에게 시료/대표 구분을 강제(`SAMPLE` 1건 필수)하는데 판정은 그걸 쓰지 않는다. 의도된 설계인지 미구현인지 결정이 필요하다.

### G. 같은 입하 행의 이중 편성을 DB가 막지 않는다 (2급)

`IX_IQC_REQ_LOT_ARR`는 `NONUNIQUE`다(실측). 중복 방지는 `create()`의 애플리케이션 레벨 검사(`listCandidates` 재조회 후 대조)뿐이라 동시 요청에서 같은 입하 행이 두 의뢰에 들어갈 수 있다.
단 `REQUESTED` 상태에서만 의미가 있고 검사 시점에는 `iqcStatus='PENDING'` 필터가 다시 걸려 이중 판정까지는 가지 않는다.

### H. 기존 패턴 (신규 결함 아님)

- `getValue('IQC_INSPECT_LOT_MODE')`(`iqc-history.service.ts:449`)에 company/plant를 넘기지 않는다. `SysConfigService.getValue`는 tenant 미지정 시 `configKey`만으로 `findOne` 한다. `IQC_SAMPLE_ISSUE_MODE`(325, 885행)도 동일하다. `IQC_FAIL_DEFECT_MOVE_MODE`(1090행)만 tenant를 넘긴다. 단일 테넌트인 현재는 무증상이다
- `listCandidates()`가 품목의 PENDING 입하를 전량 로드한 뒤 메모리에서 `taken` 필터를 건다. itemCode 단위라 유계지만 프로젝트 SQL 규칙(메모리 집계 금지)과는 어긋난다

### 정정

`0125` 기록 "다음 작업자가 바로 할 일 #2 — `1SH21A7A09`의 AQL 규칙 확인"은 해소됐다. AQL 규칙은 있다(SEQ 1,2 = AQL 1.0 / 수준 II). 시료수가 모집단과 같게 나온 원인은 위 C의 FULL 검사항목 폴백이다.

### 우선순위 제안

1. A — 모드 가드. ARRIVAL 모드면 의뢰 생성을 막거나 화면에 경고를 띄운다. 또는 REQUEST로 전환한다
2. C — 미리보기 4개 호출부에 `itemInspectedCounts`를 넘기거나, 서버가 미리보기에서 FULL 항목을 시료수 산출에서 빼도록 한다
3. B — 모집단 기준을 하나로 정한다. 표시와 판정이 같은 값을 쓰게 한다
4. D — 검사규격 AQL 미설정 항목 정리 (기준정보)
5. E/F/G — 설계 결정 후 반영

---

## 점검 결과 조치 (2026-09-16, 커밋 34ac2c43)

우선순위 A → C → B → D 순으로 처리했다. E/F/G는 설계·스키마 결정이 필요해 보고만 한다.

### A. 완료 — 모드 가드

- `IqcRequestLotService.create()`가 `IQC_INSPECT_LOT_MODE`를 읽고 REQUEST가 아니면 생성을 거절한다. 모드 판정은 `@harness/shared` `allowsIqcRequestLot()` 단일 출처
- 판정 경로가 REQUESTED 의뢰에 담긴 입하 행을 다룰 때(커밋 `ab0d6bf7`에서 범위 조정)
  - **REQUEST 모드**: 담긴 행을 판정 대상에서 빼고 잔여 행만 판정한다. 잔여가 0건이면 거절한다. `MAT_ARRIVALS` 갱신도 그 SEQ로 좁힌다
  - **ARRIVAL 모드**: 전체를 거절한다. 모드를 되돌린 상태이므로 조용히 일부만 판정하지 않고 의뢰를 정리하게 한다
  - **단건 판정**: 대상이 하나뿐이라 항상 거절한다
  - 처음에는 모드 구분 없이 전체를 거절했는데, 그러면 REQUEST 모드에서 검사대기 목록에 잔여 47행으로 떠 있는 행을 클릭해도 담긴 3행 때문에 서버가 거절했다. 화면과 서버가 어긋나는 상태였다
- 의뢰 화면에 모드 경고 배너 + 확정 버튼 비활성. 프론트가 서버 거절 사유를 그대로 표시한다
- 테스트: 모드 가드 2건, 보유 행 가드 3건 신규

### C. 완료 — 예상 시료수

원인 확정: `aql.service.ts:522-527`에서 FULL 항목은 `itemInspectedCounts`가 없으면 `inspectedQty = requiredQty = lotQty`로 폴백하고, `sampleQty`가 전 항목 최댓값이라 모집단이 된다. 미리보기 호출부 **4곳 전부** `itemInspectedCounts`를 안 넘긴다.

- `IqcAqlPolicyResolution`에 `aqlSampleQty`(AQL 항목만)와 `fullInspectQty`(전수/파괴/고정)를 분리 추가. 기존 `sampleQty`는 판정·로그용으로 그대로 둔다
- 표시 규칙은 `@harness/shared` `resolveIqcDisplaySampleQty()`/`resolveIqcFullInspectQty()` 단일 출처
- 4개 화면(의뢰 구성 / IQC 검사 모달 / 검사의뢰서 인쇄 / 품목 검사규격)이 분리값을 쓴다. 전수·파괴 소요량은 합치지 않고 따로 표시

### B. 완료 — 모집단 기준 통일

- `listCandidates()`를 `MAT_ARRIVALS × MAT_LOTS(PENDING)` 조인 집계로 바꿔 `qty`를 시리얼 `INIT_QTY` 합으로 내린다. `create()`의 `LOT_QTY`와 라인 `QTY`도 같은 값을 쓴다
- 후보 그리드에 `검사대기수량`/`시리얼수` 컬럼을 노출한다
- **부수효과**: 검사대기 시리얼이 없는 입하 행은 후보에서 빠진다. `1SH21A7A09`은 후보 60행 → **0행**이 된다(MAT_ARRIVALS는 PENDING인데 MAT_LOTS는 IQC_STATUS='CANCELED'). 빈 목록 문구에 제외 사유를 적어 뒀다
- 스냅샷 드리프트: `createRequestLotResult`는 확정 시점 `header.lotQty`를 정본으로 유지한다(검사 중 모집단이 흔들리면 Ac/Re 기준이 바뀌므로). 판정 시점 시리얼 합과 다르면 `IQC_LOGS.REMARK`에 `[모집단드리프트:확정 N vs 판정시점 M]`을 남긴다
- 실행 검증: `listCandidates` QueryBuilder를 JSHANES에 직접 실행. 생성 SQL의 alias 치환 정상, `HKEAN1W002FA` 50행 / 합계 50,000, `1SH21A7A09` 0행

### D. 조사 완료 — 조치는 사용자 결정

`IQC_PART_SPEC_ITEMS` 실측 (USE_YN='Y', 등급 있음, INSPECTION_TYPE='AQL'):

| 구분 | 항목 수 | 품목 수 |
|---|---|---|
| AQL 값 있음 | 39 | 8 |
| **AQL NULL** | **149 (79%)** | **30** |

AQL NULL 항목은 전부 `THN-A50-*` 계열이고, `IQC-*` 계열은 전부 채워져 있다. 시드 소스 `2026-09-14_seed_thn_a50_iqc.sql`이 `DEFECT_GRADE`와 `INSPECTION_TYPE='AQL'`만 넣고 AQL 값을 넣지 않는다.

결과적으로 이 149건은 `aql.service.ts:548`의 "등급은 있으나 AQL 미설정 → 불량 1건 이상이면 FAIL" 제로톨러런스 분기로 돈다. 동작은 설계된 보수적 폴백이지만, 담당자에게는 AQL 샘플링으로 보이면서 실제로는 무관용이다.

**AQL 값을 채우는 것은 품질 판정 기준 변경이라 THN 표준 관리계획 담당 결정 사항이다.** 이번 작업에서 손대지 않았다.

### E / F / G — 보고만

- **E. 의뢰↔검사이력 연결이 문자열뿐**: `IQC_LOGS`에 `REQUEST_NO` 계열 컬럼 없음(실측). 연결은 `REMARK`의 `[IQL:...]` 접두어 하나다. 컬럼 추가는 DDL이고, DDL 후 의존 PL/SQL 패키지 INVALID(ORA-04068) 처리가 따라온다. 사용자 승인 후 진행할 일
- **F. `lineRole`(시료/대표)이 판정에서 소비되지 않음**: `createRequestLotResult`에서 대표 입하번호(로그 표시용)만 정한다. 검사 대상 시리얼과 시료수는 역할과 무관하다. 판정에 반영하면 AQL 표준 샘플링과 충돌할 수 있어 설계 결정이 먼저다
- **G. 이중 편성을 DB가 막지 않음**: `IX_IQC_REQ_LOT_ARR`가 NONUNIQUE. 상태(`REQUESTED`)가 헤더 테이블에 있어 라인 테이블 단순 UNIQUE로는 못 막는다. 라인에 상태 비정규화 컬럼을 두는 설계 결정이 필요하다. 검사 시점에 `iqcStatus='PENDING'` 필터가 다시 걸려 이중 판정까지는 가지 않는다

### 곁들여 고친 것 (doubt 프로브 결과)

- **SysConfig tenant 스코프 누락**: `getValue()` 호출 20곳 중 10곳이 company/plant를 안 넘긴다. IQC 범위 3곳(`iqc-history.service.ts` 379/503/944)은 함께 고쳤다. 나머지 7곳은 범위 밖이라 보고만 한다 — `erp-material.service.ts` 210/280, `scrap.service.ts` 126, `auto-issue.service.ts` 128/209, `hv-spc.service.ts` 46. 단일 테넌트인 현재는 무증상이다
- **메뉴 코드 중복 등록**: `QC_IQC_REQUEST_LOT`이 `menuConfig.ts`, `menu-code-validator.ts`, `menu-config.json` 세 곳에 각각 두 번 등록돼 있었다. 전부 제거하고 `QC_AQL` 다음 위치로 통일했다. DB(`MENU_CATEGORY_ITEMS`)는 1건으로 정상
- **i18n 네임스페이스 통째 누락**: `material.iqcRequestLot` 27개 키가 ko/en/zh/vi 어디에도 없어 화면이 t() 폴백으로만 돌고 있었다. 4개 파일에 채웠다. 참고로 저장소 전체 미등록 키는 아직 340여 건 남아 있다(범위 밖)

### 아직 검증 못한 것

- **브라우저 전 구간 재검증을 하지 않았다.** 이번 변경은 tsc/jest/직접 SQL 실행까지만 확인했다. 특히 다음은 화면에서 봐야 한다
  - `IQC_INSPECT_LOT_MODE=REQUEST`로 바꾼 뒤 의뢰 생성 → 검사대기 노출 → 판정 전 구간
  - 모드가 ARRIVAL일 때 배너/버튼 비활성과 서버 거절 메시지
  - 4개 화면의 예상 시료수 표시가 AQL 값으로 바뀌었는지
- 운영 모드는 여전히 `ARRIVAL`이다. 전환 시점은 사용자 결정
- **표시 폴백**: `resolveIqcDisplaySampleQty()`가 null을 돌려주는 경우 화면이 `0`을 찍는 자리가 있다(`(… ?? 0).toLocaleString()`). AQL 항목이 하나도 없고 전수/파괴만 있는 품목에서 "예상 시료수 0"으로 보일 수 있다. 실제 그런 품목이 있는지 확인하고 필요하면 `-` 폴백으로 바꿔야 한다

---

## E 적용 및 REQUEST 모드 전환 (2026-09-16 11:00~11:20, 커밋 61ff5671 / b7aebf28)

### E. IQC_LOGS.REQUEST_NO — JSHANES 적용 완료

- pre-check: 컬럼 없음, IQC_LOGS 160건, REMARK에 `[IQL:` 0건, INVALID 객체 0건, 의존 객체는 `PACKAGE BODY PKG_WORKFLOW` 1건
- 적용(`apps/backend/src/migrations/2026-09-16_iqc_logs_request_no.sql`, `--execute-file` 6블록 전부 성공)
  - `ALTER TABLE IQC_LOGS ADD (REQUEST_NO VARCHAR2(50))` — `IQC_REQUEST_LOTS.REQUEST_NO`와 같은 길이
  - `COMMENT ON COLUMN`, `CREATE INDEX IX_IQC_LOGS_REQUEST_NO (COMPANY, PLANT_CD, REQUEST_NO)`
  - 백필 UPDATE(REGEXP_SUBSTR). 대상 0건. 정규식은 드리프트 노트가 붙은 REMARK에서도 의뢰번호만 뽑는 것을 실행 전 확인
  - `ALTER PACKAGE PKG_WORKFLOW COMPILE BODY`
- post-check: 컬럼 `VARCHAR2(50) NULLABLE=Y`, 인덱스 1건, 코멘트 적재, `PKG_WORKFLOW` VALID, INVALID 객체 0건
- 코드: `IqcLog.requestNo` 추가, `judgeLotsWithAql` 입력에 `requestNo`, `createRequestLotResult`가 전달. REMARK의 `[IQL:...]` 접두어는 기존 조회 호환을 위해 유지
- `docs/database/schema-erd.md` 재생성(`ORACLE_SITE=JSHANES`)

### 운영 모드 전환

`SYS_CONFIGS.IQC_INSPECT_LOT_MODE` `ARRIVAL` → **`REQUEST`** (COMPANY=40 / PLANT_CD=1000, 2026-09-16 11:12:48).
전환 시점 `IQC_REQUEST_LOTS` 0건이라 넘어갈 재고 의뢰는 없었다.

### REQUEST 모드 스모크 (서비스 레이어 직접 호출)

| 단계 | 결과 |
|---|---|
| 후보 조회 | 50건 / 수량합 50,000 |
| 검사대기 입하단위 행 | 50시리얼 / 50,000 EA |
| 의뢰 생성 | `IQL20260916-0007` / 모집단 3,000 / 라인 3 |
| 후보 축소 | 50 → 47 (담은 3행만 제외) |
| 검사대기 의뢰LOT 행 | `IQL20260916-0007` / 3시리얼 / 3,000 EA |
| 검사대기 입하단위 잔여 | 47시리얼 / 47,000 EA |
| 의뢰 시리얼 조회 | 3건 (`VH1-RM260913-00001/2/3`). requestNo 없이 조회하면 50건 |
| 취소 후 후보 복구 | 정상 |

쿼리 실행 검증도 별도로 했다. `findRequestLotHolds`, `findPendingRequestLots`, `findPendingArrivals`의 의뢰 제외 서브쿼리 모두 TypeORM alias 치환과 Oracle 실행 정상.

### 사고 — 스모크가 운영 데이터에 판정을 실행했다 (원복 완료)

스모크 스크립트에 `createArrivalResult` 호출을 넣은 것이 잘못이었다. 읽기 위주로 짰다고 판단했으나 이 호출은 쓰기다.

- 발생: `R26091300001 / HKEAN1W002FA`의 잔여 47행(SEQ 4~50)이 PASS로 판정됨 (11:17~11:18)
- 변경된 것: `MAT_LOTS` 47행 `PENDING→PASS` + `EXPIRE_DATE` 2027-09-08 채워짐, `MAT_ARRIVALS` 47행 `PENDING→PASS`, `IQC_LOGS` 1건 생성(`LOT_QTY=47000`, `AQL_SAMPLE_QTY=47000`, `RESULT=PASS`)
- 영향 없던 것: PASS라 재고 이동 없음(`IQC_FAIL_DEFECT_MOVE_MODE=MANUAL`), `VENDOR_INSPECTION_MODE_HISTORY` 0건 추가, `PARTNER_MASTERS.INSPECTION_MODE` 변경 없음
- 원복: 47행 `PENDING` + `EXPIRE_DATE=NULL`, `MAT_ARRIVALS` 47행 `PENDING`, `IQC_LOGS` 해당 1건 삭제, 의뢰 헤더/라인 0건
- post-check: `MAT_LOTS` 50 PENDING / 11 PASS / 1 CANCELED, `MAT_ARRIVALS` 동일, SEQ 4~50 `EXPIRE_DATE` 0건, 해당 입하 `IQC_LOGS` 0건 — 판정 전 상태와 일치

역설적으로 이 사고가 **잔여 행 판정 로직이 실데이터에서 설계대로 도는 것을 확인**시켜 줬다. 담긴 3행은 건드리지 않고 잔여 47행만, 모집단도 47,000으로 잡혔다.

**교훈: 운영 DB 대상 스모크에 판정·저장 계열 호출을 넣지 말 것.** 조회와 되돌리기 쉬운 쓰기(의뢰 생성/취소)까지만 넣는다.

### 곁들여 고친 것

`PendingArrivalsResult` 선언에 `requestNo`가 없었다. 런타임에는 내려가고 프론트가 자체 타입으로 받아 동작은 했지만 백엔드 계약이 실제와 어긋나 있었다. 이 사실은 스모크 스크립트를 짜다가 드러났다.

### doubt 프로브

```
의심: 이력/참조가 전용 컬럼 없이 REMARK 문자열로만 출처를 연결한다
프로브: remark에 대괄호 접두어로 참조를 심는 패턴 grep
결과: production/services/job-order.service.ts 3곳 (`[공정작업] orderNo`, `[자동생성] orderNo`, `[HOLD] 이전상태:`)
      → 같은 유형이지만 production 모듈이라 범위 밖. 보고만 한다
```

### 남은 것

- **브라우저 확인**: 화면 레벨 검증은 아직이다. 특히 4개 화면의 예상 시료수 표시, 모드 배너 제거 확인(이제 REQUEST라 배너가 안 떠야 한다), 의뢰 LOT 행 배지
- **이전 세션 잔여물**: `R26091300001`의 SEQ 1, 3이 `IQC_STATUS='PENDING'`인데 `EXPIRE_DATE`가 채워져 있다(2026-09-16 02:34 갱신). PENDING LOT에 유효기간이 있는 건 정합성에 어긋난다. 이번 사고 원복 범위 밖이라 두었다
- D(AQL NULL 149건), F(lineRole 미소비), G(이중 편성 UNIQUE) 미결

---

## PENDING LOT 유효기간 잔여물 정리 (2026-09-16, 커밋 ee387c32)

### 데이터 정리 (요청받은 것)

- pre-check: `IQC_STATUS='PENDING'`인데 `EXPIRE_DATE`가 있는 `MAT_LOTS` **2건** — `VH1-RM260913-00001`, `VH1-RM260913-00003` (둘 다 2027-09-08, 2026-09-16 02:34 갱신)
- `UPDATE MAT_LOTS SET EXPIRE_DATE=NULL WHERE IQC_STATUS='PENDING' AND EXPIRE_DATE IS NOT NULL`
- post-check: PENDING 53건 중 0건. CANCELED 80건 0건, FAIL 18건 0건, PASS 276건 중 206건(유효기간 설정 품목)은 그대로

### 원인 — 코드에 있었다

`EXPIRE_DATE`는 IQC PASS 판정 시 계산되는 파생값이다(단건 `iqc-history.service.ts:394`, 입하단위 `:996`).
그런데 `cancel()`의 복원 분기 셋 중 **입하단위 경로만** `expireDate: null`을 넣고 있었다.

| 취소 분기 | 수정 전 | 수정 후 |
|---|---|---|
| 단건 (`log.matUid`) | `{ iqcStatus: 'PENDING' }` | `{ iqcStatus: 'PENDING', expireDate: null }` |
| 입하단위 (`arrivalNo + itemCode`) | `{ iqcStatus: 'PENDING', expireDate: null }` | 변경 없음 |
| 품목 폴백 (`itemCode`) | `{ iqcStatus: 'PENDING' }` | `{ iqcStatus: 'PENDING', expireDate: null }` |

정리한 데이터가 정확히 이 경로로 재발했을 것이다.

```
의심: 판정 시 채운 파생값을 취소 경로가 되돌리지 않는다
프로브: expireDate 참조 전수 / 판정이 만드는 다른 파생값의 역전 경로 확인
결과: expireDate 취소 누락 2곳 → 함께 수정 (단건, 품목 폴백)
      다른 파생값은 이미 덮여 있다 — FAIL 재고 이동은 reverseIqcFailMove가 되돌리고,
      파괴검사 시료 자동출고는 취소 자체를 차단한다(BadRequestException)
      FAIL 18건 / CANCELED 80건 모두 EXPIRE_DATE 0건으로 실측 확인
```

## 미확인 — 의뢰 LOT 판정 취소 경로 (REQUEST 모드 전환으로 새로 열림)

코드를 읽고 추론한 것이고 **실행으로 확인하지 않았다.** 단정하지 말 것.

- `createRequestLotResult`가 만드는 `IQC_LOGS`는 `MAT_UID=null`, `ARRIVAL_NO=대표 입하번호`다
- `cancel()`은 `log.requestNo`를 보지 않고 `(arrivalNo, itemCode, iqcStatus=log.result)` 조건으로 되돌린다
- **확인할 것 1**: 같은 `ARRIVAL_NO`의 의뢰 외 행이 **이미 PASS인 상태**에서 의뢰 판정을 취소하면 그 행까지 PENDING으로 돌아가는가. 잔여 행이 아직 PENDING이면 `iqcStatus: log.result` 조건에 안 걸리므로 무증상이다 — 그 전제가 성립하는지부터 봐야 한다
- **확인할 것 2**: `IQC_REQUEST_LOTS.STATUS`가 `REQUESTED`로 복원되지 않아 재검사가 막히는가
- `IQC_LOGS.REQUEST_NO` 컬럼이 생겼으므로 그것으로 정확히 분기할 수 있다

검증하려면 운영 DB에서 의뢰 LOT 판정을 실제로 실행해야 한다. 이번 세션에서 같은 종류의 실행으로 47행을 되돌린 직후라 반복하지 않았다.

---

## 브라우저 검증 (2026-09-16, Aside 브라우저 / 로컬 dev 3002 + 최신 dist 백엔드 3003)

REQUEST 모드에서 화면 전 구간을 확인했다. **판정은 실행하지 않았다**(앞선 사고 교훈).

### `/quality/iqc-request-lot`

- 모드 경고 배너 **안 뜸** — 운영값이 REQUEST라 정상. 의뢰 확정 버튼 활성
- 후보 그리드 컬럼: 입하번호 / 행번호 / **검사대기수량** / **시리얼수** / 공급업체 (B 반영)
- 빈 목록 문구에 제외 사유 노출 확인
- 후보 50건, 각 행 검사대기수량 1,000 / 시리얼수 1
- **C 검증 핵심**: 3행(모집단 3,000)을 담으니
  `AQL II/TIGHTENED · 예상 시료수 125 · 전수/파괴 검사항목 소요 3,000`
  수정 전에는 "예상 시료수 3,000" 하나였다. AQL 시료수와 전수 소요량이 분리 표시된다
- 의뢰 확정 → `IQL20260916-0008 / HKEAN1W002FA / 3000 / REQUESTED`, 후보 50 → 47

### `/material/iqc`

- `의뢰LOT IQL20260916-0008 ... HSG-3 / 3,000 EA / 검사대기` 묶음 행 노출 (배지 포함)
- 같은 입하 `R26091300001`은 `HSG-47 / 47,000 EA`로 줄어 나란히 표시 — 담긴 3행만 빠졌다
- 두 행 모두 `IQC 검사` / `의뢰서` 버튼 정상

### 취소·정리

- 의뢰 취소 → 상태 `CANCELED`
- 테스트 데이터 삭제 후 post-check: `IQC_REQUEST_LOTS` 0건, `IQC_REQUEST_LOT_LINES` 0건,
  `HKEAN1W002FA` PENDING 50건, PENDING인데 EXPIRE_DATE 있는 LOT 0건, 신규 IQC_LOGS 0건
- 콘솔 에러 0

### 환경 메모

`pnpm dev` 기동 시 백엔드가 `EADDRINUSE :::3003`으로 죽었다. 11:32에 기동된 `node dist/main` 프로세스(PID 25292)가 포트를 잡고 있었다. 그 dist는 이번 변경이 모두 반영된 최신 빌드였고(`requestNo` 32회, `expireDate: null` 3회) 프론트는 dev(HMR)로 최신 소스를 쓰므로 검증에는 문제가 없었다. 다음 세션은 dev 기동 전에 3003 점유를 먼저 확인할 것.

### 남은 미검증

- 의뢰 LOT **판정** 경로 (PASS/FAIL 등록). 유닛 테스트와 이전 세션 브라우저 검증으로만 덮여 있다
- 의뢰 LOT **판정 취소** 경로 — 위 "미확인" 절 참조
