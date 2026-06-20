# IQC AQL 정책 코드 전환 설계

## 배경

`ITEM_MASTERS`가 `INSPECTION_LEVEL`, `AQL_CRITICAL`, `AQL_MAJOR`, `AQL_MINOR`를 직접 보유하면 품목마스터가 검사 정책 조합을 중복 저장한다. AQL 값은 품목 고유 속성보다 품질 기준정보이며, 품목은 적용할 정책을 참조하는 편이 변경 관리와 조회 정합성에 맞다.

## 결정

- `IQC_AQL_POLICIES` 기준정보를 추가한다.
- `ITEM_MASTERS`는 `IQC_AQL_POLICY_CODE`만 nullable로 보유한다.
- `IQC_AQL_POLICIES`는 `INSPECTION_LEVEL`, `MAJOR_AQL_CODE`, `MINOR_AQL_CODE`, `CRITICAL_MODE`를 보유한다.
- Critical 불량은 기존 운영 결정대로 `IMMEDIATE_FAIL`을 기본으로 유지한다.
- `/master/part`는 검사수준/Critical/Major/Minor 개별 입력을 제거하고 `AQL 정책` 선택만 제공한다.
- `/quality/aql/resolve-iqc`는 품목의 정책 코드를 따라 `AQL_STANDARDS`와 sampling rule을 산출한다.
- `IQC_PART_SPEC_ITEMS`의 검사수준/AQL은 항목별 검사 조건 override로 유지한다.

## 마이그레이션

- 신규 테이블 `IQC_AQL_POLICIES`를 생성한다.
- `ITEM_MASTERS.IQC_AQL_POLICY_CODE`를 추가한다.
- 기존 품목의 `(INSPECTION_LEVEL, AQL_MAJOR, AQL_MINOR)` 조합은 재실행 가능한 정책 코드로 변환해 seed한다.
- 기존 `INSPECTION_LEVEL`, `AQL_CRITICAL`, `AQL_MAJOR`, `AQL_MINOR` 컬럼은 정책 코드 이관 후 제거한다.

## 검증

- `/master/part` 구조 테스트는 개별 AQL 필드 미사용과 정책 선택 사용을 검증한다.
- `AqlService` spec은 품목 정책 코드로 Major/Minor Ac/Re를 계산하는지 검증한다.
- JSHANES에 마이그레이션 적용 후 테이블/컬럼/정책 row를 확인하고 ERD 문서를 재생성한다.
