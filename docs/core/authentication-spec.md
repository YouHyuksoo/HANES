# 인증 스펙

## 목적

이 문서는 로그인, 인증 상태 유지, 보호 라우트, 메뉴 권한, PDA 작업자 권한을 포함한 인증 체계의 구현 기준을 정의한다.

## 기준 코드

- 백엔드 컨트롤러: `apps/backend/src/modules/auth/auth.controller.ts`
- 백엔드 서비스: `apps/backend/src/modules/auth/auth.service.ts`
- 인증 가드: `apps/backend/src/common/guards/jwt-auth.guard.ts`
- 프론트 인증 스토어: `apps/frontend/src/stores/authStore.ts`
- 프론트 보호 컴포넌트: `apps/frontend/src/components/layout/AuthGuard.tsx`

## 인증 모델

- `user`
- `token`
- `isAuthenticated`
- `allowedMenus`
- `pdaAllowedMenus`
- `selectedCompany`
- `selectedPlant`
- `currentWorker`

## 로그인 API 스펙

### 요청

- `POST /auth/login`
- 본문: `email`, `password`, 필요 시 `company`

### 응답

- `token`
- `user`
- `allowedMenus`
- `pdaAllowedMenus`

## 현재 사용자 조회 스펙

### 요청

- `GET /auth/me`
- `Authorization: Bearer <token>`

### 응답

- 현재 사용자 정보
- 최신 `allowedMenus`
- 최신 `pdaAllowedMenus`

## 백엔드 인증 규칙

1. 보호 API는 인증 가드를 통해 토큰을 해석한다.
2. 토큰에서 사용자 식별자를 추출하고 실제 사용자 상태를 다시 확인한다.
3. 사용자 상태가 `ACTIVE`가 아니면 거부한다.
4. 회사/사업장 문맥이 필요한 API는 사용자 컨텍스트에서 함께 복구한다.

## 토큰 규칙

HANES 현재 구현 기준:

- 토큰은 실질적으로 `user.email` 기반 식별자 역할을 한다.

신규 프로젝트 권장:

- 서명형 JWT 또는 세션 토큰으로 강화하되, 프론트 흐름은 `token -> me -> store 갱신 -> 보호 라우트` 구조를 유지한다.

## 프론트 인증 스토어 규칙

1. 로그인은 store action에서 처리한다.
2. 로그인 성공 시 `token`, `user`, 권한 배열을 함께 저장한다.
3. 로그아웃은 저장소를 비우고 초기 상태로 되돌린다.
4. 앱 시작 후 인증 상태가 복원되면 `fetchMe`를 호출해 최신 상태를 검증한다.

## 보호 라우트 규칙

1. 인증이 없으면 `/login`으로 리다이렉트한다.
2. hydration 전에는 판정을 유보한다.
3. 인증은 있어도 메뉴 권한이 없으면 접근을 막는다.
4. 권한 없음 화면은 홈 또는 대시보드 복귀 동선을 제공한다.

## 메뉴 권한 규칙

- 경로에서 메뉴 코드를 찾는다.
- `ADMIN`은 전체 허용이다.
- 일반 사용자는 `allowedMenus`에 포함된 메뉴 코드만 허용한다.

## PDA 작업자 인증 규칙

1. 웹 로그인 사용자와 PDA 작업자 상태는 분리한다.
2. `currentWorker`는 별도 상태로 둔다.
3. PDA 화면 권한은 `pdaAllowedMenus`로 제어한다.
4. 작업자 해제 시 PDA 권한도 함께 초기화한다.

## 로그아웃 규칙

1. 토큰 키 제거
2. store 초기화
3. 회사/사업장 선택 상태 초기화
4. PDA 작업자 상태 초기화
5. 로그인 화면 이동

## 좋은 예시

- 로그인 후 권한 배열까지 받아 UI 렌더링과 라우트 가드를 같이 제어하는 구조
- hydration 완료 전까지 보호 라우트 판정을 보류하는 구조

## HANES 코드 예시

- 백엔드 로그인/현재 사용자: `apps/backend/src/modules/auth/auth.service.ts`
- 프론트 인증 store: `apps/frontend/src/stores/authStore.ts`
- 보호 라우트: `apps/frontend/src/components/layout/AuthGuard.tsx`

## 나쁜 예시

- 로그인 직후 토큰만 저장하고 권한 정보는 페이지마다 다시 따로 요청하는 방식
- hydration 전에 로그인 여부를 판정해 화면이 깜빡이는 방식
- 메뉴 렌더링 권한과 라우트 권한 체크 기준이 서로 다른 방식

## 적용 체크리스트

1. `/auth/login`, `/auth/me`의 책임이 분리돼 있는가
2. 인증 store가 토큰, 사용자, 메뉴 권한을 같이 관리하는가
3. hydration 대기 후 리다이렉트하는가
4. 웹 권한과 PDA 권한을 분리했는가
5. 권한 없는 경로 접근을 UI와 라우트 둘 다 막는가

## AI 입력 순서에서의 역할

- `development-stack-guide.md` 뒤에 읽는다.
- 인증, 권한, 보호 라우트가 필요한 신규 프로젝트에서 직접 구현 기준으로 사용한다.
