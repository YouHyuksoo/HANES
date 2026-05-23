# 테마 시스템 스펙

## 목적

이 문서는 라이트/다크/시스템 테마와 색상 테마 전환 구조를 구현하기 위한 기준 문서다.
저장 방식, HTML 적용 방식, CSS 토큰 구조, hydration 처리 기준을 정의한다.

## 기준 코드

- 테마 스토어: `apps/frontend/src/stores/themeStore.ts`
- 테마 적용 Provider: `apps/frontend/src/app/providers.tsx`
- 테마 훅: `apps/frontend/src/hooks/useTheme.ts`
- 헤더 토글 UI: `apps/frontend/src/components/layout/Header.tsx`
- PDA 설정 화면: `apps/frontend/src/app/pda/settings/page.tsx`
- 전역 스타일 토큰: `apps/frontend/src/app/globals.css`

## 테마 모델

- `theme`: `light | dark | system`
- `resolvedTheme`: 실제 적용된 `light | dark`
- `colorTheme`: `default | custom`

## 저장소 규칙

- 테마 상태는 전역 store에서 관리한다.
- 영속 저장은 `localStorage` 기반 persist를 사용한다.
- 저장 키는 프로젝트 단위로 고정한다.

HANES 기준:

- 저장 키: `harness-theme`

## HTML 적용 규칙

1. 실제 테마는 `document.documentElement`에 반영한다.
2. 라이트/다크는 `html`의 class로 적용한다.
3. 색상 테마는 `data-color-theme` 속성으로 적용한다.
4. SSR/hydration mismatch를 막기 위해 mount 이후 적용한다.

## 시스템 테마 규칙

1. `system` 선택 시 OS `prefers-color-scheme`를 따른다.
2. 시스템 테마가 바뀌면 런타임에서도 즉시 반영한다.
3. 저장된 `theme` 값은 `system`으로 유지하고 `resolvedTheme`만 갱신한다.

## 토큰 규칙

컴포넌트는 직접 색상을 박는 대신 의미 기반 토큰을 우선 사용한다.

예:

- `bg-surface`
- `bg-background`
- `text-text`
- `text-text-muted`
- `border-border`

## 테마 전환 UI 규칙

### 웹

- 헤더에서 빠른 라이트/다크 토글을 제공한다.
- 색상 테마 전환 버튼은 별도 버튼으로 둔다.

### PDA

- 설정 화면에서 `light`, `dark`, `system`을 명시적으로 선택하게 한다.
- 토글보다 선택형 옵션 UI가 낫다.

## hydration 규칙

1. mount 전에는 시각 출력에 보수적으로 접근한다.
2. 테마 클래스와 `resolvedTheme` 동기화는 provider에서 담당한다.
3. 시스템 테마 감시는 provider 또는 공통 effect 한 곳만 담당한다.

## 금지 규칙

- 각 페이지가 개별적으로 `document.documentElement.classList`를 조작하는 방식
- 테마 저장을 페이지 local state만으로 처리하는 방식
- 컴포넌트마다 서로 다른 테마 저장 키를 쓰는 방식

## 좋은 예시

- `themeStore`가 `theme`, `resolvedTheme`, `colorTheme`를 함께 관리하고 `providers.tsx`가 HTML에 반영하는 구조
- 웹 헤더와 PDA 설정 화면이 같은 store를 공유하면서 UI만 다르게 제공하는 구조

## HANES 코드 예시

- 스토어: `apps/frontend/src/stores/themeStore.ts`
- Provider 반영: `apps/frontend/src/app/providers.tsx`
- 헤더 토글: `apps/frontend/src/components/layout/Header.tsx`
- PDA 설정: `apps/frontend/src/app/pda/settings/page.tsx`

## 나쁜 예시

- 다크 모드 토글을 각 페이지 컴포넌트마다 따로 구현하는 방식
- 토큰 없이 `bg-black`, `text-white`를 전역적으로 흩뿌리는 방식
- 시스템 모드 지원 없이 단순 light/dark만 강제하는 방식

## 적용 체크리스트

1. `light/dark/system` 3단 모델이 있는가
2. `resolvedTheme`와 저장값이 분리돼 있는가
3. HTML class와 data attribute 적용 지점이 하나로 모여 있는가
4. 헤더와 PDA 설정이 같은 테마 스토어를 쓰는가
5. 의미 토큰 기반 CSS 변수가 존재하는가

## AI 입력 순서에서의 역할

- `navigation-spec.md` 또는 `ui-screen-patterns.md` 뒤에 읽는다.
- 전역 레이아웃, CSS 토큰, 테마 저장 방식이 필요한 프로젝트에서 기준 역할을 한다.
