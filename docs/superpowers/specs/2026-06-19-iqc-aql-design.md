# IQC AQL 기준관리 설계

> Superseded: 이 문서는 LOT 범위별 수동 AQL rule 관리 1차 설계다. 2026-06-20에 사용자가 `품목별 AQL + 업체별 검사강도 + ISO 2859-1 자동계산 + 업체 검사모드 자동전환` 정책을 확정했으므로, 최신 설계는 `docs/superpowers/specs/2026-06-20-iqc-aql-z14-policy-design.md`를 기준으로 한다.

## 목적

IQC 검사에서 수동 `SAMPLE_QTY` 입력을 없애고, 입하 LOT 수량과 품목별 AQL 기준에 따라 시료수, 합격 허용수(Ac), 불합격 판정수(Re)를 자동 산출한다.

## 확정 범위

- 1차 적용 대상은 IQC다.
- 품질관리 메뉴 하위에 `AQL 기준관리` 페이지를 추가한다.
- 기존 `IQC_PART_SPECS.SAMPLE_QTY`는 1차에서 화면과 로직에서 사용하지 않는다.
- `IQC_PART_SPECS.SAMPLE_QTY` 컬럼은 안정화 전까지 물리 삭제하지 않는다.
- 품목별 IQC 기준은 수동 시료수 대신 `AQL_CODE`를 선택한다.
- IQC 검사 입력은 입하 LOT 수량 기준으로 AQL rule을 해석해 시료수/Ac/Re를 보여준다.
- IQC 이력은 당시 적용된 AQL 코드, 시료수, Ac, Re를 저장한다.

## 비범위

- OQC AQL 적용은 2차다.
- `IQC_PART_SPECS.SAMPLE_QTY` 물리 삭제는 2차다.
- MIL-STD-105E 전체 검사수준/코드문자 자동 계산은 1차에서 하지 않는다.
- 기존 `IQC_LOGS.INSPECT_CLASS` 의미는 변경하지 않는다. 이 컬럼은 legacy 검사분류이며 IQC 검사구분 또는 AQL 판정축으로 사용하지 않는다.

## 메뉴와 화면

새 메뉴:

- code: `QC_AQL`
- labelKey: `menu.quality.aql`
- path: `/quality/aql`
- 위치: `QUALITY` 하위, `QC_IQC_PART_SPEC` 다음 또는 `QC_IQC` 앞

`/quality/aql` 화면은 운영형 기준정보 화면이다.

- 좌측 목록: AQL 기준 헤더
- 우측 상세: LOT 수량 범위별 sampling rule
- 주요 필드:
  - AQL 코드
  - AQL 명칭
  - 검사수준
  - AQL 값
  - 사용여부
  - 비고
  - LOT 수량 From/To
  - 시료수
  - Ac
  - Re

`/master/iqc-part-spec` 변경:

- 수동 시료수 입력 제거
- 품목별 AQL 기준 Select 추가
- 파괴검사 여부, 검사항목/규격 관리는 유지

`/material/iqc` 검사 모달 변경:

- 수동 시료수 입력 제거
- 적용 AQL, LOT 수량, 시료수, Ac, Re 표시
- AQL 기준이 없거나 LOT 수량에 맞는 rule이 없으면 저장을 막고 명확한 메시지를 표시

## 데이터 모델

신규 테이블 `AQL_STANDARDS`

- `COMPANY`
- `PLANT_CD`
- `AQL_CODE`
- `AQL_NAME`
- `INSPECTION_LEVEL`
- `AQL_VALUE`
- `USE_YN`
- `REMARK`
- `CREATED_BY`
- `UPDATED_BY`
- `CREATED_AT`
- `UPDATED_AT`

주 키:

- `COMPANY + PLANT_CD + AQL_CODE`

신규 테이블 `AQL_SAMPLING_RULES`

- `COMPANY`
- `PLANT_CD`
- `AQL_CODE`
- `LOT_QTY_FROM`
- `LOT_QTY_TO`
- `SAMPLE_SIZE`
- `ACCEPT_QTY`
- `REJECT_QTY`
- `SORT_ORDER`
- `CREATED_BY`
- `UPDATED_BY`
- `CREATED_AT`
- `UPDATED_AT`

주 키:

- `COMPANY + PLANT_CD + AQL_CODE + LOT_QTY_FROM`

변경 테이블 `IQC_PART_SPECS`

- 추가: `AQL_CODE`
- 유지: `SAMPLE_QTY`, 단 1차에서는 미사용

변경 테이블 `IQC_LOGS`

- 추가: `AQL_CODE`
- 추가: `AQL_SAMPLE_SIZE`
- 추가: `AQL_ACCEPT_QTY`
- 추가: `AQL_REJECT_QTY`
- 유지: `DESTRUCT_SAMPLE_QTY`

`DESTRUCT_SAMPLE_QTY`는 실제 파괴검사/시료 차감 수량으로 남긴다. 신규 IQC 저장 로직에서는 AQL 산출 `AQL_SAMPLE_SIZE`를 기준으로 값을 채운다.

## API

신규 AQL 기준관리 API:

- `GET /quality/aql`
- `GET /quality/aql/:aqlCode`
- `POST /quality/aql`
- `PUT /quality/aql/:aqlCode`
- `DELETE /quality/aql/:aqlCode`
- `GET /quality/aql/resolve?itemCode=...&lotQty=...`

품목별 IQC 기준 API 변경:

- `GET /master/iqc-part-specs/:itemCode` 응답에 `aqlCode` 포함
- `POST /master/iqc-part-specs` 요청에 `aqlCode` 포함
- `sampleQty`는 요청에서 받더라도 1차 UI에서는 보내지 않는다. 백엔드는 기존 클라이언트 호환을 위해 optional로 둔다.

IQC 저장 API 변경:

- 프론트가 직접 `sampleQty`를 입력하지 않는다.
- 백엔드는 저장 시 품목별 AQL과 LOT 수량으로 AQL rule을 다시 산출한다.
- 산출값을 `IQC_LOGS.AQL_*`와 `DESTRUCT_SAMPLE_QTY`에 저장한다.
- 클라이언트가 임의로 보낸 시료수보다 서버 산출값이 우선한다.

## 산출 규칙

1. IQC 대상 품목의 `IQC_PART_SPECS.AQL_CODE`를 찾는다.
2. 입하 LOT 수량을 구한다.
3. `AQL_SAMPLING_RULES`에서 `LOT_QTY_FROM <= lotQty <= LOT_QTY_TO`인 rule을 찾는다.
4. rule의 `SAMPLE_SIZE`, `ACCEPT_QTY`, `REJECT_QTY`를 적용한다.
5. rule이 없으면 IQC 저장을 막는다.

LOT 수량 기준은 1차에서 입하 대상의 총 검사 대상 수량으로 둔다. 시리얼 단위 검사 화면에서는 검사대기 시리얼 수량 합계와 서버의 입하 수량 중 실제 저장 서비스가 검증 가능한 값을 사용한다.

## 오류 처리

- 품목별 AQL 기준 없음: `AQL 기준이 지정되지 않았습니다. 품목별 IQC 기준에서 AQL을 선택하세요.`
- LOT 수량 범위 rule 없음: `LOT 수량에 해당하는 AQL sampling rule이 없습니다.`
- AQL 기준 비활성: `사용 중지된 AQL 기준입니다.`
- rule 중복: 저장 시 같은 AQL 코드 안에서 LOT 수량 범위가 겹치면 거부한다.

## 테스트 기준

- AQL rule 범위 해석 단위 테스트
- 범위 중복 저장 거부 테스트
- 품목별 IQC 기준에서 `sampleQty` 없이 `aqlCode` 저장 테스트
- IQC 저장 시 서버가 AQL 산출값을 이력에 저장하는 테스트
- IQC 품목별 기준 화면에서 수동 시료수 입력 제거 구조 테스트
- IQC 검사 모달에서 수동 시료수 입력 제거 및 AQL 산출 표시 구조 테스트
- 메뉴 코드와 validator 동기화 구조 테스트
- Oracle 마이그레이션 적용 후 ERD 문서 재생성

## 위험과 완화

- 기존 `SAMPLE_QTY` 의존 화면이 남을 수 있다.
  - `rg "sampleQty|SAMPLE_QTY"`로 IQC 축을 전수 확인한다.
- IQC 이력의 `INSPECT_CLASS`와 AQL 검사구분이 섞일 수 있다.
  - `INSPECT_CLASS`는 변경하지 않고 AQL 전용 컬럼만 추가한다.
- 서버가 클라이언트 시료수를 신뢰하면 조작 가능하다.
  - 저장 서비스에서 AQL을 재산출한다.
- DB 컬럼 삭제를 동시에 하면 롤백 리스크가 커진다.
  - 1차에서는 컬럼을 유지하고 미사용 처리한다.
