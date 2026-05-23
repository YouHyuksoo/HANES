# 개발환경 및 기술스택 가이드

## 목적

이 문서는 HANES와 유사한 프로젝트를 새로 구성할 때 기준으로 삼아야 할 개발환경, 런타임, 필수 도구, 버전 정책을 정리한 문서다.
`environment-setup-guide.md`가 실행 절차와 초기 설정 순서를 다룬다면, 이 문서는 어떤 기술을 어떤 수준으로 채택해야 하는지에 대한 기준 문서다.

## 권장 사용 방식

- 신규 프로젝트의 기술스택을 확정할 때 먼저 읽는다.
- AI에게 프로젝트 환경 기준을 주입할 때 `ai-project-bootstrap.md` 다음 단계로 넣는다.
- 실제 설치와 실행은 `environment-setup-guide.md`와 함께 본다.

## 스택 기준 요약

- 모노레포: Turborepo
- 패키지 매니저: `pnpm`
- 공용 언어: TypeScript
- 백엔드: NestJS + TypeORM + Oracle Database
- 프론트엔드: Next.js App Router + React
- 상태/데이터: React Query, Zustand
- 스타일링: Tailwind CSS
- 문서 산출물: `docx`, `xlsx`, PDF/인쇄 보조 라이브러리

## 운영체제 기준

- 기본 개발 환경은 Windows를 기준으로 본다.
- PowerShell 명령, 포트 정리 스크립트, Oracle 로컬 접속 가이드는 Windows 환경을 우선 기준으로 작성한다.
- 다른 운영체제를 사용할 수는 있지만, 스크립트 호환성은 별도 점검이 필요하다.

## 런타임 및 버전 정책

### 루트 기준

- Node.js: `>=20.0.0`
- pnpm: `>=10.0.0`
- TypeScript: `^5.7.x`
- Turborepo: `^2.4.x`

### 백엔드 기준

- NestJS: `^11.x`
- TypeORM: `^0.3.x`
- Oracle 드라이버: `oracledb ^6.x`
- Jest: `^30.x`
- ESLint: `^9.x`

### 프론트엔드 기준

- Next.js: `^15.x`
- React: `^19.x`
- React Query: `^5.x`
- Zustand: `^5.x`
- Tailwind CSS: `^4.x`

## 저장소 구조 기준

- `apps/backend`: NestJS API 서버
- `apps/frontend`: Next.js 웹/PDA 프론트엔드
- `packages/shared`: 공용 타입과 공용 유틸
- `docs/core`: 기준 문서
- `docs/tools`: 문서 생성 스크립트
- `exports`: 생성 산출물

## 패키지 매니저 및 모노레포 기준

### 패키지 매니저

- `pnpm`만 사용한다.
- 루트 `package.json`의 `packageManager` 선언을 기준으로 버전을 맞춘다.
- `npm` 또는 `yarn` 혼용을 허용하지 않는다.

### 모노레포 운영 원칙

- 루트 명령은 `turbo`를 통해 앱별 작업을 위임한다.
- `build`는 상위 의존 작업을 먼저 수행한다.
- `dev`는 캐시 없이 persistent 모드로 실행한다.
- `lint`, `test`는 기본적으로 빌드 의존성을 가진다.

## 백엔드 기술 기준

### 프레임워크와 구조

- HTTP 서버는 NestJS를 사용한다.
- 기능은 모듈 단위로 나누고, `controller -> service -> entity/repository` 계층을 유지한다.
- 엔티티는 TypeORM 기준으로 작성한다.

### 데이터베이스 기준

- 주 데이터베이스는 Oracle Database다.
- TypeORM은 엔티티 매핑과 일반 CRUD에 사용한다.
- 복잡한 집계, 대량 처리, Oracle 특화 SQL은 QueryBuilder 또는 Raw SQL 사용을 허용한다.
- TypeORM CLI는 환경 제약이 있을 수 있으므로, 실제 운영에서는 Raw SQL 또는 별도 스크립트 전략을 병행한다.

### 백엔드 필수 라이브러리 축

- `@nestjs/common`, `@nestjs/core`, `@nestjs/config`
- `@nestjs/typeorm`
- `@nestjs/swagger`
- `class-validator`, `class-transformer`
- `oracledb`
- `jest`, `supertest`

### 백엔드 스크립트 기준

- 개발: `pnpm --filter @harness/backend dev`
- 빌드: `pnpm --filter @harness/backend build`
- 실행: `pnpm --filter @harness/backend start`
- 테스트: `pnpm --filter @harness/backend test`

## 프론트엔드 기술 기준

### 프레임워크와 구조

- 프론트엔드는 Next.js App Router를 사용한다.
- React 19 기준 컴포넌트 구조를 따른다.
- 웹 화면과 PDA 화면을 같은 앱 내 라우트 그룹으로 관리한다.

### 상태 및 데이터 처리

- 서버 상태는 React Query를 우선 사용한다.
- 클라이언트 UI 상태는 Zustand를 사용한다.
- HTTP 클라이언트는 `axios`를 기준으로 본다.

### UI 기준

- 기본 스타일 시스템은 Tailwind CSS다.
- 공통 UI 컴포넌트, 배지, 코드 선택 컴포넌트는 재사용 가능한 형태로 관리한다.
- 차트, 바코드, PDF, 엑셀 출력 라이브러리는 화면 요구사항에 따라 선택적으로 붙인다.

### 프론트엔드 스크립트 기준

- 개발: `pnpm --filter @harness/frontend dev`
- 빌드: `pnpm --filter @harness/frontend build`
- 실행: `pnpm --filter @harness/frontend start`

## 필수 로컬 도구

- Git
- Node.js 20+
- pnpm 10+
- Oracle 접속 가능 환경
- PowerShell

필요 시 추가:

- VS Code 또는 동등한 TypeScript IDE
- DB 접속 도구
- 포트/프로세스 확인 도구

## 환경 변수 기준

### 백엔드

- `DB_HOST`
- `DB_PORT`
- `DB_SERVICE_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_SITE`
- `JWT_SECRET`

### 프론트엔드

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DEFAULT_LOCALE`

### 운영 원칙

- 앱별 `.env` 파일을 분리한다.
- 프론트엔드는 `NEXT_PUBLIC_` 접두사를 명확히 구분한다.
- 비밀값은 문서에 하드코딩하지 않는다.

## 포트 정책

- 프론트엔드 개발 서버 기본 포트: `3002`
- 백엔드 개발 포트는 프로젝트 정책에 따라 고정한다.
- 문서와 스크립트에 사용하는 포트는 충돌 없이 일관되게 유지한다.

## 테스트 및 품질 기준

- 루트 기준 테스트 명령은 `pnpm test`
- 백엔드는 Jest 기반 단위/통합 테스트를 사용한다.
- 린트는 루트와 앱 단위 모두 유지한다.
- 기능 완료 판단 전에 최소한 관련 앱의 빌드 또는 테스트를 검증한다.

## 문서 및 산출물 기준

- 기준 문서는 `docs/core`
- 문서 생성 도구는 `docs/tools`
- 생성 산출물은 `exports`

## 다른 프로젝트에 재사용할 때 유지해야 할 것

- Turborepo + pnpm 기반 모노레포 구조
- NestJS + TypeORM + Oracle 조합
- Next.js App Router + React Query + Zustand 조합
- 코드 기준 문서와 산출물 분리 원칙
- Oracle 특화 SQL과 ORM 사용 범위를 구분하는 원칙

## 다른 프로젝트에 재사용할 때 바꿔도 되는 것

- 프로젝트명
- 도메인 모듈 이름
- 프론트엔드 세부 UI 라이브러리
- 차트/바코드/PDF/엑셀 부가 라이브러리
- 포트 번호 세부값

## 적용 체크리스트

- Node.js와 pnpm 버전 정책을 먼저 고정했는가
- 루트 `package.json`과 `turbo.json` 작업 구조를 먼저 정의했는가
- 백엔드 DB 기준을 Oracle로 명확히 못 박았는가
- 프론트엔드 상태 관리와 API 호출 방식을 먼저 통일했는가
- `.env` 파일 규칙과 포트 정책을 문서화했는가
- 문서와 산출물 저장 경로를 분리했는가

## AI 입력 순서에서의 역할

이 문서는 AI에게 "이 프로젝트가 어떤 기술 조합과 버전 정책 위에서 움직여야 하는가"를 고정하는 역할을 한다.
신규 프로젝트에서는 `ai-project-bootstrap.md` 다음, `architecture-principles.md` 이전 또는 직후에 넣는 것이 가장 효과적이다.
