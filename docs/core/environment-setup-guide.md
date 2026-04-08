# 환경 설정 가이드

## 목적

이 문서는 HANES와 유사한 프로젝트를 구성할 때 필요한 실행 환경과 기본 설정 기준을 정리한 문서다.

## 기술 스택 기준

- 모노레포: Turborepo
- 패키지 매니저: `pnpm`
- 백엔드: NestJS + TypeORM
- 프론트엔드: Next.js App Router
- 데이터베이스: Oracle Database
- 공용 언어: TypeScript

## 루트 환경

### 필수 도구

- Node.js 20 이상
- pnpm 10 이상
- Oracle 접속 가능 환경

### 루트 스크립트 기준

- 개발: `pnpm dev`
- 빌드: `pnpm build`
- 린트: `pnpm lint`
- 테스트: `pnpm test`

### Turborepo 기준

- `build`는 상위 의존 작업을 먼저 수행한다.
- `dev`는 캐시 없이 persistent 모드로 실행한다.
- `lint`, `test`는 기본적으로 빌드 이후 수행된다.

## 백엔드 환경

### 기본 스택

- NestJS 11 계열
- TypeORM 0.3 계열
- Oracle DB 드라이버 `oracledb`

### 백엔드 스크립트 기준

- 개발: `nest start --watch`
- 빌드: `nest build`
- 실행: `node dist/main`
- 테스트: `jest`

### DB 연결 기준

- Oracle 사이트 정보를 명시적으로 관리한다.
- DDL 실행 전 실제 스키마를 먼저 확인한다.
- TypeORM CLI만으로 모든 작업을 처리하지 않는다는 점을 감안한다.

### 권장 환경 변수 예시

- `DB_HOST`
- `DB_PORT`
- `DB_SERVICE_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_SITE`
- `JWT_SECRET`

## 프론트엔드 환경

### 기본 스택

- Next.js 15 계열
- React 19 계열
- React Query
- Zustand
- Tailwind CSS

### 프론트엔드 스크립트 기준

- 개발: `next dev --turbopack -p 3002`
- 빌드: `next build`
- 실행: `next start`

### 권장 환경 변수 예시

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DEFAULT_LOCALE`

## 폴더 구조 기준

- `apps/backend`
- `apps/frontend`
- `docs/core`
- `docs/tools`
- `exports`

필요하면 공용 타입과 유틸을 위한 `packages/shared` 또는 동등한 공통 패키지를 둔다.

## 포트와 실행 기준

- 프론트엔드 개발 서버 포트는 `3002`
- 백엔드 포트는 프로젝트 정책에 맞춰 고정한다
- 사용자가 이미 실행 중인 개발 서버와 중복 실행하지 않는다

## 문서 및 산출물 기준

- 기준 문서는 `docs/core`
- 문서 생성 도구는 `docs/tools`
- 생성 산출물은 `exports`

## 신규 프로젝트 적용 순서

1. 루트 패키지와 Turborepo 설정
2. 백엔드 NestJS + TypeORM + Oracle 연결
3. 프론트엔드 Next.js App Router 구조
4. 도메인 모듈 생성
5. 공통 코드, 상태값, 엔티티 규칙 반영
6. AI 규격 문서 주입
