# HARNESS MES 프로젝트 설정

## AI 협업 보드 (다중 AI 작업 시 필수)

이 repo는 여러 AI 세션(Claude, Codex 등)이 동시에 작업할 수 있다. 작업 시작 전 다음을 순서대로 읽는다:

1. `AGENTS.md`
2. `.ai-coordination/README.md`
3. `.ai-coordination/STATE.md`
4. `.ai-coordination/TASKS.md`
5. `.ai-coordination/DECISIONS.md`
6. `.ai-coordination/LOCKS.md`

다음 상황일 때 추가로 `.ai-coordination/PROTOCOL.md`를 읽는다:
- 충돌, stale lock, DB 변경, 마이그레이션, 큰 리팩토링, 리뷰 핸드오프, 위험한 공유 모듈 수정

규칙:

- 다른 AI가 `.ai-coordination/LOCKS.md`에 잠근 파일은 사용자 승인 없이 수정하지 않는다.
- 편집 전에 본인 agent 이름·task ID·예정 파일을 `LOCKS.md`에 기록한다.
- `.ai-coordination/TASKS.md`는 active-work-only로 유지한다(`TODO`/`IN_PROGRESS`/`REVIEW`/`BLOCKED`).
- 완료 작업은 `TASKS.md`에서 제거하고 `.ai-coordination/ARCHIVE.md`에 한 줄만 남긴다. 상세 내역·검증은 `.ai-coordination/JOURNAL.md`에 적는다.
- 세션 종료 전 `.ai-coordination/HANDOFF/claude.md`를 갱신한다.
- 사용자나 다른 agent의 변경을 되돌리지 않는다.
- 협업 변경(`.ai-coordination/`, `AGENTS.md`)과 기능 변경은 별도 커밋으로 분리한다.
- `AGENTS.md`의 프로젝트 규칙은 본 문서와 함께 따른다.

스킬: 보드 셋업·점검·핸드오프 자동화가 필요하면 `ai-coordination` 스킬을 호출한다.

## 패키지 매니저

- `pnpm`을 사용한다. `npm`은 사용하지 않는다.
- Turborepo + pnpm 모노레포 구조를 기준으로 본다.
- 기본 명령은 `pnpm install`, `pnpm dev`, `pnpm build`를 사용한다.

## 데이터베이스

- Oracle Database를 사용한다.
- DDL 실행과 스키마 확인은 `oracle-db` 또는 검증된 SQL 경로를 우선 사용한다.
- 컬럼 타입 변경은 실제 스키마 확인 없이 진행하지 않는다.
- DDL/DML 실행 시 사이트를 명시한다. 기본 사이트는 `JSHANES`다.
- INSERT나 시드 SQL 작성 전 실제 테이블 스키마를 먼저 확인한다.

## 테스트와 검증

- Playwright는 사용하지 않는다.
- 검증은 API 호출, CLI 체크, `pnpm build` 기준으로 진행한다.
- 빌드는 구현 완료 후 검증·사용자 요청·코드 리뷰 시에만 실행한다 (불필요한 실행 금지).
- 사용자가 이미 개발 서버를 띄운 상태면 `pnpm build`를 실행하지 않는다. dev 서버 실행 중 프로덕션 빌드는 `.next` 캐시를 손상시킨다. 타입 체크만 필요하면 `pnpm --filter @harness/frontend exec tsc --noEmit`을 사용한다.
- 서버 필요 시 먼저 포트 확인.
- 프론트엔드 개발 서버 포트는 `3002`를 사용한다.
- 구현 완료 체크리스트: DB 테이블/컬럼 일치, 시드 데이터, menuConfig, i18n 4파일, 빌드 에러 0건.

## UI 규칙

- `alert()`, `confirm()`, `prompt()`를 사용하지 않는다. 모달 컴포넌트를 사용한다.
- 통계 카드는 `StatCard`를 우선 사용한다.
- DataGrid의 `split`이나 `pin` 요청은 고정 컬럼 의미로 해석한다.
- flex 스크롤 영역에는 `min-h-0`를 명시한다.
- 코드성 데이터 입력은 가능한 한 셀렉트나 콤보박스를 사용한다.
- 공통 필터와 공통 입력 컴포넌트는 `components/shared/`를 우선 사용한다.

## 공통 코드

- 코드값 표시는 `ComCodeBadge`, `ComCodeSelect`, `useComCode` 계열을 우선 사용한다.
- 상태 텍스트와 색상을 화면에서 하드코딩하지 않는다.
- 상세 규칙은 `docs/core/common-code-guide.md`를 따른다.

## 코드 품질

- 에러를 기본값 문자열로 숨기지 않는다.
- `catch (error: unknown)` 형태를 유지한다.
- `as any` 사용을 피한다.
- 멀티테넌시 기능에는 `COMPANY`, `PLANT_CD` 스코프를 포함한다.
- 수정 후에는 `pnpm build` 기준으로 에러가 없는 상태에서 완료를 보고한다.

## 엔티티 규칙

- `@PrimaryGeneratedColumn` 남용을 피한다.
- 가능하면 자연키 또는 복합키를 먼저 검토한다.
- Oracle 컬럼명은 `name: 'UPPER_SNAKE_CASE'`로 명시한다.
- 재고 수량의 현재값은 `MatStock` 기준으로 관리한다.

## API 규칙

- 프론트엔드 구현 전 백엔드 컨트롤러 경로를 먼저 확인한다.
- 경로는 `/<모듈>/<리소스>` 형태를 기본으로 한다.
- 상태 전이 API는 의미가 드러나는 하위 경로를 사용한다.

## 작업 방식

- 아키텍처나 큰 구조 변경은 먼저 기준 문서를 확인한다.
- 수정 요청은 해당 범위만 바꾸고 불필요한 재구성은 하지 않는다.
- 스킬 실행 시 반드시 프로젝트 루트에서 실행한다.
- 작업 완료 시 완료 범위·남은 것·다음 단계를 보고한다.
- 신규 프로젝트나 큰 기능 설계 시 `docs/core/ai-project-bootstrap.md`를 우선 참고한다.
