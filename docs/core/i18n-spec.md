# 다국어 스펙

## 목적

이 문서는 번역 리소스 구조, 언어 전환, 브라우저 감지, 공통 코드 폴백, HTML lang 동기화까지 포함한 다국어 구현 기준을 정의한다.

## 기준 코드

- i18n 초기화: `apps/frontend/src/lib/i18n.ts`
- 언어 전환 UI: `apps/frontend/src/components/layout/LanguageSwitcher.tsx`
- HTML lang 동기화: `apps/frontend/src/app/providers.tsx`
- 메뉴 번역 키: `apps/frontend/src/config/menuConfig.ts`
- 공통 코드 번역 폴백: `apps/frontend/src/components/ui/ComCodeBadge.tsx`
- 번역 리소스: `apps/frontend/src/locales/ko.json`, `en.json`, `zh.json`, `vi.json`

## 지원 언어 기준

HANES 기준 지원 언어:

- `ko`
- `en`
- `zh`
- `vi`

## 리소스 구조 규칙

1. 언어별 JSON 파일을 분리한다.
2. 동일한 키 구조를 모든 언어 파일에서 유지한다.
3. 공통, 헤더, 인증, 메뉴, 도메인별 키를 계층형으로 나눈다.

예:

- `common.save`
- `auth.login`
- `header.logout`
- `menu.master.part`
- `material.physicalInv.sessionCompleted`

## 초기화 규칙

1. i18n 초기화는 앱 provider 레벨에서 한 번만 수행한다.
2. 브라우저 언어 감지는 자동으로 수행할 수 있다.
3. 저장된 언어가 있으면 그것을 우선한다.
4. fallback 언어를 반드시 지정한다.

HANES 기준:

- fallback language: `ko`
- detection order: `localStorage`, `navigator`

## 언어 전환 규칙

1. 언어 전환은 전역 i18n 인스턴스를 통해 수행한다.
2. 현재 언어는 전환 UI에서 명확히 보인다.
3. 언어 전환 후 페이지 새로고침 없이 즉시 반영돼야 한다.

## HTML lang 규칙

1. 현재 언어는 `document.documentElement.lang`에 반영한다.
2. 이 동기화는 provider 레벨에서 한 곳만 담당한다.

## 메뉴 번역 규칙

1. 메뉴 라벨은 문자열 하드코딩 대신 `labelKey`를 사용한다.
2. 메뉴 설정 파일은 번역 키만 들고 있어야 한다.
3. 렌더링 시점에 `t(labelKey)`를 호출한다.

## 공통 코드 폴백 규칙

1. 공통 코드 라벨은 먼저 번역 키를 조회한다.
2. 번역이 없으면 DB 표시명을 사용한다.
3. 그것도 없으면 코드값 자체를 마지막 폴백으로 사용한다.

## 번역 키 네이밍 규칙

1. 의미 기반 계층 구조를 유지한다.
2. 화면 경로명이 아니라 기능 의미를 우선한다.
3. 공통 키와 도메인 키를 섞지 않는다.
4. 같은 의미의 버튼 텍스트는 공통 키를 재사용한다.

## 신규 기능 추가 규칙

1. UI 문구 추가 시 먼저 기존 키 재사용 가능 여부를 확인한다.
2. 새 키를 만들면 모든 지원 언어 파일에 동시 반영한다.
3. 메뉴 추가 시 `menu.*` 키도 함께 추가한다.
4. 공통 코드가 번역 대상이면 `comCode.<group>.<code>` 키 체계를 따른다.

## 좋은 예시

- `supportedLanguages` 배열을 기준으로 UI와 로직을 함께 관리하는 구조
- `ComCodeBadge`가 번역 키 -> DB codeName -> code 순으로 폴백하는 구조

## HANES 코드 예시

- i18n 초기화: `apps/frontend/src/lib/i18n.ts`
- 언어 전환: `apps/frontend/src/components/layout/LanguageSwitcher.tsx`
- 메뉴 키: `apps/frontend/src/config/menuConfig.ts`
- 공통 코드 폴백: `apps/frontend/src/components/ui/ComCodeBadge.tsx`

## 나쁜 예시

- 언어 전환 UI는 있는데 실제 컴포넌트는 하드코딩 문자열을 쓰는 방식
- 일부 언어 파일에만 키가 있고 나머지 언어에는 누락된 방식
- 메뉴 라벨과 상태 라벨을 번역 키가 아니라 상수 문자열로 두는 방식

## 적용 체크리스트

1. 지원 언어 배열과 리소스 파일이 일치하는가
2. fallback 언어가 명확한가
3. HTML lang 동기화가 있는가
4. 메뉴와 공통 코드에 번역 키 체계가 있는가
5. 번역 실패 폴백 규칙이 정의돼 있는가

## AI 입력 순서에서의 역할

- `ui-screen-patterns.md` 뒤 또는 `common-code-guide.md` 앞에 읽는다.
- 다국어와 상태/코드 표시 체계가 있는 프로젝트에서 구현 기준이 된다.
