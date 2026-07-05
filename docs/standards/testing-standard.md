---
sources:
  - apps/backend/src/shared/transaction.service.ts
verifiedCommit: 2e8d7f56
---

# HANES Test Standard

## 목적

HANES 테스트는 실행 가능하고 관리되는 회귀 방지 자산이어야 한다. 테스트 파일은 생성 후 방치하지 않고, 실패하면 수정하거나 명시적으로 폐기한다.

## 테스트 등급

| 등급 | 위치 | 도구 | 목적 |
| --- | --- | --- | --- |
| unit | `apps/backend/src/**/*.spec.ts` | Jest | 서비스, 컨트롤러, 가드, 순수 정책 로직을 mock 기반으로 검증 |
| policy | `*.policy.spec.ts`, `*.workflow.spec.ts` | Jest | 삭제, 취소, 상태전이, 권한, 업무 규칙 검증 |
| architecture | `apps/backend/src/architecture/*.spec.ts` | Jest | 모듈 경계, 금지 패턴, shared type 계약 검증 |
| frontend-unit | `apps/frontend/src/**/*.test.ts(x)` 또는 `*.spec.ts(x)` | Jest + Testing Library | 프론트 컴포넌트, 훅, 파라미터 생성, 표시 조건 검증 |
| e2e | `apps/frontend/e2e/*.spec.ts` | Playwright | 로그인, 메뉴 이동, 실제 브라우저 업무 흐름 검증 |
| live-data | 문서화된 수동/스크립트 검증 | Oracle + API + UI | JSHANES 실제 데이터 흐름 검증 |

현재 프론트에는 Playwright만 구성되어 있다. 프론트 Jest를 도입할 때는 `frontend-unit` 등급으로만 추가하고, 실제 업무 흐름 검증은 Playwright/live-data로 유지한다.

## 표준 명령

루트에서 실행한다.

```powershell
pnpm.cmd run test:backend
pnpm.cmd run test:backend:ci
pnpm.cmd run typecheck:backend
pnpm.cmd run typecheck:frontend
pnpm.cmd run verify
```

백엔드 패키지 내부 표준 명령:

```powershell
pnpm.cmd --dir apps/backend run test:unit
pnpm.cmd --dir apps/backend run test:ci
pnpm.cmd --dir apps/backend run test:architecture
pnpm.cmd --dir apps/backend run test:changed
```

`pnpm.cmd --filter @harness/backend test -- --runInBand`는 사용하지 않는다. 현재 스크립트 구조에서는 `--runInBand`가 Jest 옵션이 아니라 테스트 패턴으로 해석될 수 있다.

## 백엔드 Jest 작성 규칙

- 파일명은 소스 옆 `*.spec.ts`를 기본으로 한다.
- 테스트 대상은 `target`으로 선언한다.
- mock 의존성은 `mockXxx` 이름을 쓴다.
- Nest 서비스/컨트롤러는 `Test.createTestingModule`로 구성한다.
- TypeORM Repository는 `getRepositoryToken(Entity)`로 mock 주입한다.
- DB 실연결은 unit/policy 테스트에서 금지한다.
- 실제 Oracle, API, UI가 필요한 검증은 live-data 검증으로 분리한다.
- 테스트는 Arrange, Act, Assert 순서를 유지한다.
- 단순 `toBeDefined()`만으로 끝나는 검증은 금지한다. 결과 값, 호출 인자, 상태 변화를 구체적으로 검증한다.
- `describe.only`, `it.only`, `describe.skip`, `it.skip`는 커밋 금지다.
- 실패 테스트는 커밋 금지다. 정책이 바뀌었으면 테스트 기대값을 현재 업무 규칙에 맞게 갱신한다.

## 정책/워크플로우 테스트

업무 규칙은 서비스 CRUD 테스트 안에 묻지 말고 별도 spec으로 분리한다.

예:

- `prod-result.delete.policy.spec.ts`
- `prod-result.complete.workflow.spec.ts`
- `defect-log.policy.spec.ts`
- `rework.policy.spec.ts`

정책 테스트는 “무엇을 허용/차단하는지”를 테스트명에 명확히 쓴다.

## Architecture 테스트

`apps/backend/src/architecture/*.spec.ts`는 코드 스타일 테스트가 아니라 구조 안전장치다.

- 실패하면 기본 판단은 “테스트 수정”이 아니라 “위반 코드 수정”이다.
- 예외가 필요하면 테스트에 allowed list를 추가하기 전에 왜 예외인지 문서화한다.
- 수동 `QueryRunner` 트랜잭션 제어는 `TransactionService`로 모은다.
- unsafe cast, `as never`, request/user 임의 캐스팅은 금지한다.

## CI/배포 Gate

배포 workflow는 build 전에 아래 gate를 통과해야 한다.

```powershell
pnpm.cmd run test:backend:ci
pnpm.cmd run typecheck:backend
pnpm.cmd run typecheck:frontend
```

이 중 하나라도 실패하면 배포하지 않는다.

## 프론트 테스트 기준

프론트 Jest를 도입하면 아래만 Jest 대상으로 삼는다.

- 공통 컴포넌트 렌더링과 이벤트
- 훅 상태 전이
- 필터/API 파라미터 생성
- 입력값 검증과 버튼 활성/비활성 조건
- 순수 계산 함수

아래는 Playwright 또는 live-data 검증 대상이다.

- 로그인 후 메뉴 이동
- 실제 브라우저 레이아웃/스크롤/포커스
- 작업지시 선택부터 생산실적 등록까지의 업무 흐름
- 실제 DB 반영 여부

## 폐기 기준

다음 테스트는 유지하지 않는다.

- 현재 업무 규칙과 반대인 낡은 테스트
- 소스가 사라진 뒤 의미 없이 남은 테스트
- mock만 맞추고 실제 동작 의미가 없는 테스트
- CI에서 항상 제외해야만 하는 테스트

폐기 대신 업무 규칙 검증 가치가 있으면 policy 또는 architecture 테스트로 다시 작성한다.
