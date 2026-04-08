# HARNESS MES 프로젝트 설정

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
- 사용자가 이미 개발 서버를 띄운 상태면 중복 실행하지 않는다.
- 프론트엔드 개발 서버 포트는 `3002`를 사용한다.

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
- 신규 프로젝트나 큰 기능 설계 시 `docs/core/ai-project-bootstrap.md`를 우선 참고한다.
