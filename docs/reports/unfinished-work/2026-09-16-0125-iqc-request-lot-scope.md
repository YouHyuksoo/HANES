# 미완료 작업 기록: IQC 검사의뢰 LOT 화면 범위 정리와 복합키 정상화

- 작성시각: 2026-09-16 01:25 KST (02:10 갱신)
- 작성자: claude
- 작업 범위: `/quality/iqc-request-lot` 화면과 `quality/iqc-request-lots` API
- 현재 상태: 검증대기

## 완료한 것

### 1. 화면 책임 범위 정리

사용자 확인 사항: 이 화면의 목적은 **LOT 구성과 검사의뢰까지**이며 합불 판정은 AQL을 타는 IQC 검사 화면에서 한다.

화면에 들어가 있던 AQL 우회 판정 경로를 제거했다.

- 의뢰 목록의 `IQC 검사` 버튼과 `의뢰 LOT 일괄 판정` 모달(검사자 입력 + PASS/FAIL 버튼) 제거
- 의뢰 구성 카드의 `시료수량` 자유입력 제거
- `POST /quality/iqc-request-lots/:requestNo/inspect`, `IqcRequestLotService.inspect()`, `InspectIqcRequestLotDto` 제거
- `CreateIqcRequestLotDto.sampleQty` 제거. `create()`는 `sampleQty: null`로 저장한다
- `IqcRequestLotService`의 `IqcHistoryService` 의존 제거
- AQL 산출값(검사수준/검사모드/예상 시료수)은 모집단 크기 판단용 읽기전용 표시로 유지
- 판정 경로 제거로 파괴검사 시료 재고 미차감 문제(`applyIqcVerdictToArrivals`에 `autoIssueDestructSample` 블록 없음)는 자동 해소

### 2. (차단이었음 → 해소) 입하 행 복합키 정상화

`MAT_ARRIVALS`의 PK는 복합키 `(ARRIVAL_NO, SEQ)`인데 이 기능 전체가 `arrivalNo` 단독을 고유키로 가정하고 있었다.

실제 데이터: `1SH21A7A09` 품목의 PENDING 입하 60행이 전부 `ARRIVAL_NO='R26090900001'`(SEQ 1~60). 그 결과 `create()`의 `arrivals.length !== arrivalNos.length` 검사가 항상 실패해 **의뢰 확정 자체가 불가능**했다. 커밋 `48b5bace`부터 있던 버그다.

다음을 모두 `(arrivalNo, seq)` 복합키 기준으로 바꿨다.

- `listCandidates()`가 `seq`를 반환한다. 사용중 입하 제외도 `arrivalNo#arrivalSeq` 키로 판정한다
- `IqcRequestLotLineInputDto.arrivalSeq` 추가 (`@IsInt() @Min(1)`)
- `create()`가 `ARRIVAL_NO` 단독 조회 후 `(ARRIVAL_NO, SEQ)`로 행을 특정한다. 중복 검사, 사용중 검사, 수량 합산, 라인 생성이 모두 복합키 기준이다
- `IQC_REQUEST_LOT_LINES.ARRIVAL_SEQ` 컬럼 추가 (JSHANES 적용 완료)
- 프론트 `RequestCandidate.seq`, `arrivalRowKey()` 헬퍼, `getRowId`, `addToBasket`/`addVisible`/`removeFromBasket` 키를 복합키로 변경. 후보 그리드에 `행번호` 컬럼 추가

### 3. (차단이었음 → 해소) 채번 채널 미등록

복합키를 고치자 다음 단계에서 `채번 실패 (IQC_REQUEST_LOT): SEQ_RULES에 규칙이 등록되어 있는지 확인하세요.`가 떴다.

migration이 `SEQ_LEGACY_IQC_REQUEST_LOT` 시퀀스를 만들어 뒀는데 `NumberingService.LEGACY_SEQUENCE_FORMATS`에 채널 등록이 빠져 있어 `SEQ_RULES` 조회로 폴백하다 실패한 것이다.

- `NumberingService.LEGACY_SEQUENCE_FORMATS`에 `IQC_REQUEST_LOT: { sequence: 'SEQ_LEGACY_IQC_REQUEST_LOT', prefix: 'IQL', pad: 4 }` 추가
- `numbering.service.spec.ts`의 legacy 채널 표에 동일 케이스 추가
- Oracle `SEQUENCE.NEXTVAL` 경로를 그대로 쓴다. `MAX(SEQ)+1` 류는 쓰지 않았다

## 미완료 / 남은 것

### 의뢰 LOT을 IQC 검사 화면에 연결 (사용자 결정 대기)

판정을 제거했으므로 확정된 의뢰 LOT이 `/material/iqc`에 검사 대기로 떠야 한다.

- 현재 `/material/iqc`는 의뢰 LOT 존재를 전혀 모른다 (repo 전체 grep 참조 0건)
- `SYS_CONFIGS.IQC_INSPECT_LOT_MODE = 'ARRIVAL'`이 JSHANES에 있으나 **코드에서 읽는 곳이 한 곳도 없다.** migration 파일에만 존재한다
- 연결 UX(별도 탭인지, 기존 목록에 묶음 행으로 섞는지)를 먼저 정해야 한다

### 참고: AQL 시료수가 모집단수량과 같게 나온다

모집단 100이면 예상 시료수 100, 300이면 300으로 나온다. `1SH21A7A09`에 AQL 규칙이 없어 전수검사로 폴백하는 것으로 보인다. 이번 작업 범위 밖이며 별도 확인이 필요하다.

## 변경 파일

- `apps/frontend/src/app/(authenticated)/quality/iqc-request-lot/page.tsx`: 시료수량 입력·IQC 검사 버튼·판정 모달 제거, `행번호` 컬럼 추가, `getRowId`/장바구니 키를 복합키로, 안내 문구와 책임범위 주석 추가
- `apps/frontend/src/hooks/material/useIqcRequestLot.ts`: `inspect()`/`sampleQty`/`inspectTarget`/`inspector` 제거, `seq` 필드와 `arrivalRowKey()` 추가, `removeFromBasket()` 추가, POST 페이로드에 `arrivalSeq` 포함
- `apps/backend/src/modules/material/controllers/iqc-request-lot.controller.ts`: `POST :requestNo/inspect` 제거
- `apps/backend/src/modules/material/services/iqc-request-lot.service.ts`: `inspect()`와 `IqcHistoryService` 의존 제거, `arrivalKey()` 헬퍼 추가, `listCandidates()`/`create()`를 복합키 기준으로 재작성, 책임범위 주석 추가
- `apps/backend/src/modules/material/services/iqc-request-lot.service.spec.ts`: `IqcHistoryService` mock 제거, 실데이터 복합키 재현 테스트 2건 추가
- `apps/backend/src/modules/material/dto/iqc-request-lot.dto.ts`: `InspectIqcRequestLotDto`와 `CreateIqcRequestLotDto.sampleQty` 제거, `IqcRequestLotLineInputDto.arrivalSeq` 추가
- `apps/backend/src/entities/iqc-request-lot-line.entity.ts`: `arrivalSeq` 컬럼과 인덱스 반영
- `apps/backend/src/shared/numbering.service.ts`: `IQC_REQUEST_LOT` legacy 채번 채널 등록
- `apps/backend/src/shared/numbering.service.spec.ts`: 동일 채널 테스트 추가
- `apps/backend/src/migrations/2026-09-16_iqc_request_lot_arrival_seq.sql`: 신규
- `docs/database/schema-erd.md`: 재생성

## DB 변경 (JSHANES 적용 완료)

- pre-check: `IQC_REQUEST_LOTS` 0건, `IQC_REQUEST_LOT_LINES` 0건, `ARRIVAL_SEQ` 컬럼 없음
- `ALTER TABLE IQC_REQUEST_LOT_LINES ADD (ARRIVAL_SEQ NUMBER DEFAULT 1 NOT NULL)`
- `COMMENT ON COLUMN IQC_REQUEST_LOT_LINES.ARRIVAL_SEQ`
- `DROP INDEX IX_IQC_REQ_LOT_ARR` 후 `(COMPANY, PLANT_CD, ARRIVAL_NO, ARRIVAL_SEQ, ITEM_CODE)`로 재생성
- post-check: 컬럼 `NUMBER NOT NULL DEFAULT 1` 확인, 인덱스 5개 컬럼 순서 확인
- connector가 PL/SQL 익명 블록을 파싱하지 못해(`PLS-00103`) `--execute-file` 대신 단일 DDL로 나눠 적용했다. migration 파일도 실행된 형태로 맞춰 뒀다

## 검증 상태

- 실행함: backend tsc 0 error, frontend tsc 0 error
- 실행함: `jest iqc-request-lot.service.spec.ts` 4 pass (복합키 재현 2건 포함)
- 실행함: `jest numbering.service.spec.ts` legacy 채널 표에 `IQC_REQUEST_LOT` 포함 pass
- 실행함: `jest src/modules/material src/shared/numbering src/architecture` 38 suite 중 37 pass / 645 test 중 644 pass
- 실행함: 브라우저 3002 전체 사이클
  - 후보 60건 조회, `행번호` 컬럼으로 SEQ 1~60 구분 확인
  - 서로 다른 3행(#60, #59, #2)을 담아 모집단수량 300 집계 확인 (수정 전에는 1건 100으로 접혔음)
  - 의뢰 확정 성공 → `IQL20260916-0001 / 1SH21A7A09 / 300 / REQUESTED`
  - DB 확인: 헤더 1건, 라인 3건에 `ARRIVAL_SEQ` 60/59/2 저장됨
  - 후보 재조회 60 → 57 (담은 3행만 제외, 입하번호 전체가 빠지지 않음)
  - 취소 → 상태 `CANCELED`, 후보 57 → 60 복구
  - 콘솔 에러 0
- 실행함: 테스트 데이터 정리. `IQL20260916-0001` 헤더/라인 삭제 후 `IQC_REQUEST_LOTS` 0건, `IQC_REQUEST_LOT_LINES` 0건, `1SH21A7A09` PENDING 입하 60건 원복 확인
- 실행 못함: 의뢰 LOT의 실제 IQC 판정 흐름. `/material/iqc` 연결이 미구현이라 검사 대기로 넘어가지 않는다

## 기존 실패 (이번 변경과 무관)

`src/architecture/module-boundary.spec.ts`의 `does not add new simple runtime any escape hatches` 1건이 실패한다.

- offenders: `modules/quality/control-plan/services/` 4개 파일
- `git status`상 미수정 파일이며 커밋 `9c250304 feat(quality): THN 표준 관리계획 시드와 문서 시스템 구현`에서 들어왔다
- 이번 작업 범위 밖이라 손대지 않았다

## 중단 사유

- `/material/iqc` 연결은 UX 결정이 선행되어야 한다. 사용자 결정 대기.

## 다음 작업자가 바로 할 일

1. `IQC_INSPECT_LOT_MODE` 분기를 `/material/iqc`에 구현해 의뢰 LOT을 검사 대기로 노출한다. 현재 이 SYS_CONFIG를 읽는 코드가 없다.
2. `1SH21A7A09`의 AQL 규칙을 확인한다. 시료수가 모집단수량과 동일하게 산출된다.
3. `module-boundary.spec.ts` 기존 실패 4파일을 control-plan 담당자와 정리한다.

## 주의사항

- 이 화면에 PASS/FAIL 판정이나 시료수 자유입력을 **다시 추가하면 안 된다.** AQL Ac/Re 판정을 우회하게 된다. `page.tsx`, `useIqcRequestLot.ts`, `iqc-request-lot.service.ts` 주석에도 같은 내용을 남겼다.
- `applyIqcVerdictToArrivals()`(`iqc-history.service.ts:671`)는 AQL 정책을 호출하지 않고 프론트 판정을 그대로 확정한다. 새 경로에서 재사용하지 말 것.
- **입하 행을 다룰 때 `ARRIVAL_NO` 단독을 고유키로 쓰지 말 것.** `MAT_ARRIVALS` PK는 `(ARRIVAL_NO, SEQ)`다. 같은 `ARRIVAL_NO`가 수십 행 존재한다.
- 변경분은 전부 미커밋 상태다. 같은 트리에 직전 작업(메뉴 등록)의 `receiving.module.ts` 변경도 미커밋으로 남아 있다.
- JSHANES에 남은 잔여 테스트 데이터는 없다.
