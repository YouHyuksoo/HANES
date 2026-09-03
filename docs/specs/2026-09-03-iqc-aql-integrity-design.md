# 품목-AQL 정책 연결 무결성 보강 설계

## 배경

JSHANES 실데이터에서 IQC 대상 품목 46개는 모두 활성 AQL 정책과 연결되어 있고 AQL 기준표, Code Letter, 샘플수량, Ac/Re 연결도 완결되어 있다. 다만 IQC 비대상 품목 `MAG_TAPE00008NA`에 정책 코드가 남아 있으며, `ITEM_MASTERS.IQC_AQL_POLICY_CODE`에는 물리 FK가 없고 품목 저장 서비스는 정책 코드 입력 여부만 검사한다.

품목별 검사항목이 없는 IQC 대상 품목도 존재하지만, 현재 사용 가능한 템플릿은 운영 기준으로 확정되지 않은 `테스트1`뿐이다. 품목별 규격을 추정하여 자동 생성하면 잘못된 검사와 판정을 만들 수 있다.

## 목표

- IQC 비대상 품목의 불필요한 AQL 정책 연결을 제거한다.
- IQC AQL 정책이 필요한 품목은 동일 회사·공장의 활성 정책만 저장할 수 있게 한다.
- DB에서도 품목 정책 코드가 동일 tenant의 정책을 참조하도록 강제한다.
- 검사항목이 없는 품목에는 근거 없는 기준을 자동 생성하지 않는다.

## 설계

### 애플리케이션 검증

`PartService`에 `IqcAqlPolicy` repository를 주입하고 `MasterModule`의 TypeORM 등록에도 같은 entity를 추가한다. 등록·수정 시 최종 `iqcYn`, `inspectMethod`, `iqcAqlPolicyCode`를 계산한 뒤 다음 규칙을 적용한다.

1. `requiresIqcAqlPolicy()`가 참이면 정책 코드가 반드시 있어야 한다.
2. 정책 코드는 trim 후 대문자로 정규화하며 조회와 저장에 같은 값을 사용한다.
3. 정책 코드가 있으면 `COMPANY`, `PLANT_CD`, `POLICY_CODE`, `USE_YN='Y'` 조건으로 실제 정책을 조회한다.
4. 정책이 없거나 비활성이면 저장을 거부한다.
5. IQC 비대상 또는 무검사 품목에서 정책 코드가 전달되면 `null`로 정규화하여 잔여 연결을 만들지 않는다.

정책 검증은 create와 update가 공유하는 단일 private helper로 구현한다.

### 역방향 상태전이 검증

- 품목에 배정된 정책은 `updatePolicy()`에서도 `USE_YN='N'`으로 변경하지 못하게 한다.
- 활성 정책의 Major/Minor 코드로 참조되는 AQL 기준은 `update()`에서 `USE_YN='N'`으로 변경하지 못하게 한다.
- 기존 `deletePolicy()`의 tenant 배정 건수 검사와 같은 기준을 사용한다.

### 데이터베이스 무결성

Migration SQL은 다음 순서를 사용한다.

1. `IQC_FLAG <> 'Y'` 또는 `INSPECT_METHOD IN ('SKIP','NONE')`인 품목의 `IQC_AQL_POLICY_CODE`를 `NULL`로 정리한다.
2. 고아 정책 연결이 없는지 검증한다.
3. `ITEM_MASTERS(COMPANY, PLANT_CD, IQC_AQL_POLICY_CODE)`에서 `IQC_AQL_POLICIES(COMPANY, PLANT_CD, POLICY_CODE)`로 복합 FK를 추가한다.

SQL은 재실행 가능한 PL/SQL 블록으로 작성하고 JSHANES에 적용한다. 적용 전후 대상 건수와 FK 상태를 확인한다.

### 검사항목 미등록 데이터

검사항목이 없는 30개 품목은 자동 생성하지 않는다. 원자재 20개는 품목별 도면·검사규격 또는 승인된 템플릿이 필요하고, 반제품·완제품 10개는 IQC 대상 여부 자체를 업무 담당자가 확인해야 한다. 해당 목록은 미완료 작업 기록으로 남긴다.

`resolveIqcPolicyByItem()`은 IQC 대상이면서 활성 검사항목이 없으면 품목 정책만으로 PASS 판정하지 않고 설정 오류로 차단한다. IQC 비대상 또는 `SKIP`/`NONE` 품목은 기존 면제 흐름을 유지한다.

## 오류 처리

- 필수 정책 미선택: 기존 메시지를 유지한다.
- 존재하지 않는 정책: `선택한 AQL 정책을 찾을 수 없습니다.`
- 비활성 정책: `사용 중지된 AQL 정책은 선택할 수 없습니다.`
- tenant가 다른 정책은 존재하지 않는 정책과 동일하게 차단한다.
- 활성 검사항목 없음: `활성 IQC 검사항목이 설정되지 않은 품목입니다.`
- 사용 중인 정책·AQL 기준의 사용중지 요청은 배정 또는 참조 중임을 알리고 거부한다.

## 검증

- 실패 테스트로 존재하지 않는 정책, 비활성 정책, 다른 tenant 정책, 정책 코드 정규화, IQC 비대상 정책 제거를 먼저 증명한다.
- 검사항목 없는 IQC 대상 품목의 판정 차단과 IQC 면제 품목의 기존 흐름을 테스트한다.
- 배정된 정책 및 정책에서 참조 중인 AQL 기준의 사용중지 차단을 테스트한다.
- 기존 품목 서비스 테스트와 backend typecheck를 실행한다.
- JSHANES 적용 전후 잔여 연결, 고아 연결, 활성 IQC 품목의 정책 누락 및 FK 상태를 조회한다.
- 스키마 변경 후 `tools/generate_db_schema_doc.py`로 ERD를 갱신한다.
