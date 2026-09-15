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
- 실행 못함: FAIL 경로(불량창고 이동)와 파괴검사 시료 자동출고 경로의 실데이터 검증. PASS 경로만 확인했다

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
