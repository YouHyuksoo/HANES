# IQC AQL Z1.4 Policy Design

## 목적

IQC 수입검사에서 품목별 AQL 기준과 업체별 검사강도를 사용해 ISO 2859-1 / ANSI ASQ Z1.4 방식의 샘플링 검사 기준을 자동 산출한다. 사용자는 Ac/Re를 직접 입력하지 않고, 검사자는 Critical/Major/Minor 불량 수량만 입력한다. 시스템은 Critical 1건 이상 즉시 FAIL, Major/Minor Ac/Re 기준 판정, 업체 품질 이력 기반 검사모드 자동 전환까지 처리한다.

## 확정 원칙

- AQL은 공급업체 기준이 아니라 품목 기준이다.
- 공급업체는 검사강도만 관리한다.
- `IQC_PART_SPECS.SAMPLE_QTY`는 `기본시료수`로 유지한다. 의미는 검사 시 사용할 기본 시료 채취량이다.
- AQL 기반 `샘플수량`은 사용자가 직접 입력하지 않는다. 품목 AQL, 업체 검사모드, LOT 수량, ISO 2859-1 sampling table로 산출한다.
- Critical 불량은 AQL Ac/Re와 무관하게 1건 이상이면 즉시 LOT FAIL이다.
- 판정 당시 품목 AQL, 업체 검사모드, 코드문자, 샘플수량, Ac/Re, 불량 수량을 이력에 저장한다.

## 기존 설계와 차이

기존 `2026-06-19-iqc-aql-design.md`는 `/quality/aql`에서 LOT 범위별 `sampleSize/Ac/Re`를 직접 관리하는 단순 rule 방식이었다. 이 방식은 새 요구사항의 `품목별 Critical/Major/Minor AQL`, `업체별 검사강도`, `ISO 2859-1 자동 계산`, `업체 검사모드 자동 전환`을 만족하지 못한다.

새 설계에서 `/quality/aql`은 최종적으로 ISO 2859-1 / ANSI ASQ Z1.4 기준표와 산출 결과를 확인하는 관리 화면으로 재정의한다. 운영자가 품목별로 관리하는 것은 `ITEM_MASTERS`의 검사수준과 Critical/Major/Minor AQL 값이다.

## 품목 기준정보

`ITEM_MASTERS`에 아래 컬럼을 추가한다.

- `INSPECTION_LEVEL`: 일반검사 I/II/III 또는 특별검사 S-1~S-4
- `AQL_CRITICAL`: Critical 결점 AQL. 기본 0
- `AQL_MAJOR`: Major 결점 AQL
- `AQL_MINOR`: Minor 결점 AQL

`/master/part` 또는 `/master/iqc-part-spec` 중 기존 운영 흐름상 품목별 IQC 기준을 관리하는 화면에서 위 값을 관리한다. `/master/iqc-part-spec`은 이미 품목별 IQC 기준 화면이므로 1차 UI는 이 화면에 붙이는 것이 적합하다.

`기본시료수`는 기존 `IQC_PART_SPECS.SAMPLE_QTY`에 남긴다. 이 값은 ISO 자동 산출을 사용할 수 없는 예외나 현장 기본 채취량 참고값으로 표시한다. AQL 자동 판정의 샘플수량과 같은 개념으로 쓰지 않는다.

## 업체 기준정보

`PARTNER_MASTERS`에 아래 컬럼을 추가한다.

- `QUALITY_GRADE`: 업체 품질등급. 예: A/B/C
- `INSPECTION_MODE`: `TIGHTENED`, `NORMAL`, `REDUCED`

`PARTNER_TYPE='SUPPLIER'`인 거래처에 대해 검사모드를 관리한다. 검사모드는 품목별 AQL을 바꾸지 않고 ISO sampling table 선택 또는 전환 rule에만 영향을 준다.

## ISO 2859-1 산출 모델

산출 입력:

- 품목 검사수준
- 품목 Critical/Major/Minor AQL 값
- 업체 검사모드
- LOT 수량

산출 결과:

- `CODE_LETTER`
- `SAMPLE_QTY`
- Critical/Major/Minor별 `ACCEPT_QTY`, `REJECT_QTY`

테이블 구성:

- `AQL_CODE_LETTER_RULES`
  - `INSPECTION_LEVEL`
  - `LOT_QTY_FROM`
  - `LOT_QTY_TO`
  - `CODE_LETTER`
- `AQL_ACCEPTANCE_RULES`
  - `INSPECTION_MODE`
  - `CODE_LETTER`
  - `AQL_VALUE`
  - `SAMPLE_QTY`
  - `ACCEPT_QTY`
  - `REJECT_QTY`

Critical AQL 값이 0인 경우에도 샘플수량은 Major/Minor 산출 결과 중 필요한 검사 샘플수량으로 결정할 수 있다. Critical 판정은 불량 1건 이상 즉시 FAIL rule을 우선 적용한다.

샘플수량은 Critical/Major/Minor 각각의 acceptance rule에서 계산한 값 중 가장 큰 값을 사용한다. 검사자는 그 수량만큼 검사하고 결점 등급별 불량 수량을 입력한다.

## IQC 실행 흐름

1. 입하 대상에서 품목, 업체, LOT 수량을 확인한다.
2. `ITEM_MASTERS`에서 검사수준과 Critical/Major/Minor AQL을 조회한다.
3. `PARTNER_MASTERS`에서 업체 검사모드를 조회한다.
4. ISO table에서 코드문자와 샘플수량, 결점 등급별 Ac/Re를 산출한다.
5. 검사 화면에 산출값을 읽기 전용으로 표시한다.
6. 검사자는 Critical/Major/Minor 불량 수량을 입력한다.
7. Critical 불량이 1건 이상이면 즉시 FAIL.
8. Major 또는 Minor 불량이 각 Re 이상이면 FAIL.
9. 모든 결점 등급이 Ac 이하이면 PASS.
10. 결과와 산출 기준을 `IQC_LOGS` 또는 IQC 전용 결과 테이블에 저장한다.

## 이력 저장

`IQC_LOGS`에 최소 아래 컬럼을 추가한다.

- `AQL_INSPECTION_LEVEL`
- `AQL_INSPECTION_MODE`
- `AQL_CODE_LETTER`
- `AQL_SAMPLE_QTY`
- `AQL_CRITICAL`
- `AQL_MAJOR`
- `AQL_MINOR`
- `AQL_CRITICAL_ACCEPT_QTY`
- `AQL_CRITICAL_REJECT_QTY`
- `AQL_MAJOR_ACCEPT_QTY`
- `AQL_MAJOR_REJECT_QTY`
- `AQL_MINOR_ACCEPT_QTY`
- `AQL_MINOR_REJECT_QTY`
- `DEFECT_CRITICAL`
- `DEFECT_MAJOR`
- `DEFECT_MINOR`
- `AQL_JUDGE_REASON`

기존 `INSPECT_CLASS`는 legacy 검사분류 컬럼이므로 AQL 검사강도나 결점등급 의미로 재사용하지 않는다.

## 업체 검사모드 자동 전환

검사 완료 후 업체별 최근 IQC LOT 이력을 기준으로 검사모드를 평가한다.

전환 rule:

- `NORMAL -> TIGHTENED`
  - 최근 5 LOT 중 2 LOT 이상 FAIL
  - 또는 연속 FAIL 2회
- `NORMAL -> REDUCED`
  - 최근 10 LOT 연속 PASS
  - 그리고 Major/Critical 불량 없음
- `TIGHTENED -> NORMAL`
  - 최근 5 LOT 연속 PASS
- `REDUCED -> NORMAL`
  - FAIL 발생

전환 이력은 별도 `VENDOR_INSPECTION_MODE_HISTORY`에 저장한다.

## 화면 변경

`/master/iqc-part-spec`

- 기본시료수 유지: `IQC_PART_SPECS.SAMPLE_QTY`
- 품목 AQL 영역 추가: 검사수준, Critical AQL, Major AQL, Minor AQL
- AQL 샘플수량은 직접 입력하지 않고 LOT 수량 입력 또는 선택된 입하 LOT 기준 미리보기로 표시

`/master/partner` 또는 거래처 화면

- 공급업체 품질등급
- 검사모드
- 최근 검사 이력/자동전환 이력 표시

`/material/iqc`

- 업체, 품목, LOT 수량 표시
- 검사수준, 업체 검사모드, 코드문자, 샘플수량 표시
- Critical/Major/Minor Ac/Re 표시
- Critical/Major/Minor 불량 수량 입력
- 자동 판정 결과와 이유 표시

`/quality/aql`

- 1차 기존 rule 화면은 유지 가능하나 최종적으로 ISO 기준표 관리/조회 화면으로 재정의한다.
- 운영자가 Ac/Re를 개별 입력하는 업무 화면으로 사용하지 않는다.

## API

신규 또는 변경 API:

- `GET /quality/aql/resolve?itemCode=...&vendorCode=...&lotQty=...`
  - 품목 AQL + 업체 검사모드 + LOT 수량으로 산출 결과 반환
- `POST /material/iqc-history/arrival`
  - 클라이언트가 Ac/Re를 보내지 않는다.
  - 서버가 다시 resolve 후 불량 수량으로 판정한다.
- `POST /quality/iqc/vendor-mode/evaluate`
  - 특정 업체 또는 검사 완료 LOT 기준으로 검사모드 자동평가 실행

## 오류 처리

- 품목 AQL 기준 없음: `품목별 AQL 기준이 없습니다. 품목별 IQC 기준에서 검사수준과 AQL 값을 등록하세요.`
- 업체 검사모드 없음: `공급업체 검사모드가 없습니다. 거래처 마스터에서 검사모드를 등록하세요.`
- LOT 수량 기준 코드문자 없음: `LOT 수량에 해당하는 ISO 2859-1 코드문자를 찾을 수 없습니다.`
- AQL acceptance rule 없음: `AQL 값과 검사모드에 해당하는 Ac/Re 기준을 찾을 수 없습니다.`
- Critical 불량: `Critical 불량이 발생하여 AQL 기준과 무관하게 불합격입니다.`

## 단계별 구현 범위

1차:

- 품목별 검사수준/Critical/Major/Minor AQL 컬럼과 UI 추가
- 업체 품질등급/검사모드 컬럼과 UI 추가
- ISO table seed와 resolve API 추가
- IQC 검사 화면에 산출값 표시
- IQC 저장 시 서버 판정 및 이력 저장

2차:

- 업체 검사모드 자동 전환
- 전환 이력 화면
- 기존 `/quality/aql` 화면을 ISO 기준표 관리/조회 화면으로 재정의

3차:

- OQC 적용
- 고급 switching rule 설정화
- Critical/Major/Minor 결점항목별 자동 집계

## 테스트 기준

- 품목 AQL 컬럼 entity/migration 테스트
- 업체 검사모드 컬럼 entity/migration 테스트
- ISO code letter 산출 테스트
- 검사모드별 Ac/Re 산출 테스트
- Critical 1건 즉시 FAIL 테스트
- Major/Minor Ac/Re 판정 테스트
- IQC 저장 시 서버가 클라이언트 판정 대신 재판정하는 테스트
- 업체 검사모드 자동전환 rule 테스트
- `/master/iqc-part-spec` 구조 테스트
- `/material/iqc` 구조 테스트
- JSHANES migration 적용 및 ERD 재생성

