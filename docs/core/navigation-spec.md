# 네비게이션 스펙

## 목적

이 문서는 웹 사이드바, 상단 헤더, PDA 메뉴를 포함한 네비게이션 구조의 구현 기준을 정의한다.
메뉴 데이터 구조, 권한 필터링, 반응형 동작, 라우트 연동 방식을 규격으로 고정하는 문서다.

## 기준 코드

- 메뉴 정의: `apps/frontend/src/config/menuConfig.ts`
- 웹 사이드바: `apps/frontend/src/components/layout/Sidebar.tsx`
- 사이드바 렌더링: `apps/frontend/src/components/layout/SidebarMenu.tsx`
- 상단 헤더: `apps/frontend/src/components/layout/Header.tsx`
- PDA 메뉴 구성: `apps/frontend/src/components/pda/pdaMenuConfig.ts`
- PDA 메뉴 렌더링: `apps/frontend/src/components/pda/PdaMenuGrid.tsx`
- 인증별 메뉴 권한 데이터: `apps/frontend/src/stores/authStore.ts`

## 메뉴 데이터 구조

### 웹 메뉴

- `code`: 권한 체크용 고유 코드
- `labelKey`: i18n 번역 키
- `path`: 라우트 경로
- `icon`: 최상위 메뉴 아이콘
- `children`: 하위 메뉴 배열

### 설계 원칙

1. 메뉴 표시 기준은 하드코딩 JSX가 아니라 설정 배열이어야 한다.
2. 권한 체크 기준은 라우트가 아니라 메뉴 코드여야 한다.
3. 번역 라벨은 `labelKey` 기준으로 렌더링한다.
4. 상위 메뉴는 자식 메뉴 중 하나라도 권한이 있으면 표시 가능해야 한다.

## 권한 모델

### 웹 메뉴 권한

- 로그인 응답과 `me` 응답은 `allowedMenus` 배열을 내려준다.
- `ADMIN`은 예외적으로 전체 메뉴 허용으로 본다.
- 일반 사용자는 `allowedMenus`에 없는 메뉴를 볼 수 없다.

### PDA 메뉴 권한

- PDA는 `pdaAllowedMenus` 배열을 별도로 사용한다.
- PDA 작업자 권한은 일반 웹 권한과 분리한다.

## 웹 사이드바 스펙

### 상태 정의

- `isOpen`: 모바일 오버레이 표시 여부
- `collapsed`: 데스크톱 축소 여부
- `expandedMenus`: 펼쳐진 상위 메뉴 목록

### 필수 동작

1. 데스크톱에서는 고정 사이드바를 사용한다.
2. 모바일에서는 오버레이 사이드바를 사용한다.
3. 현재 경로에 해당하는 메뉴는 활성 상태를 표시한다.
4. 축소 상태에서는 상위 아이콘 중심으로 보인다.
5. 모바일 오픈 시 배경 오버레이를 함께 띄운다.
6. 상위 메뉴 클릭은 자식 펼침/접힘으로 동작한다.

## 상단 헤더 스펙

### 포함 요소

- 모바일 메뉴 토글
- 로고
- 데스크톱 사이드바 접기/펼치기 버튼
- 검색 입력
- 알림
- 컬러 테마 토글
- 라이트/다크 토글
- 언어 전환
- 회사/사업장 표시
- 사용자 드롭다운 메뉴

### 사용자 메뉴 최소 항목

- 프로필
- 설정
- 로그아웃

## PDA 메뉴 스펙

1. 웹 메뉴와 분리된 별도 메뉴 구성을 사용한다.
2. 카드형 또는 그리드형 메뉴를 우선한다.
3. 작업자 권한 기준으로 노출 여부를 제어한다.
4. 스캔 흐름 중심 메뉴를 상단에 둔다.

## 라우트 연동 규칙

1. URL과 메뉴 코드를 역으로 찾을 수 있어야 한다.
2. 보호 라우트는 현재 경로에서 메뉴 코드를 찾아 권한을 다시 검증한다.
3. 메뉴와 실제 라우트가 어긋나면 보호 로직이 깨지므로, 둘은 한 소스에서 관리해야 한다.

## 반응형 규칙

- `lg` 이상: 고정 사이드바
- `lg` 미만: 슬라이드인 오버레이
- 모바일에서는 메뉴 선택 후 자동으로 닫히는 동작을 권장한다.

## 접근성 규칙

1. 메뉴 토글 버튼에는 `aria-label`을 둔다.
2. 사용자 드롭다운은 `aria-haspopup`, `aria-expanded`를 둔다.
3. ESC 키로 닫히는 동작을 지원한다.
4. 오버레이 클릭으로 닫히는 동작을 제공한다.

## 좋은 예시

- 메뉴 구조를 `menuConfig`에 두고, 렌더링은 `Sidebar`와 `SidebarMenu`가 담당하는 구조
- 로그인 후 `allowedMenus`, `pdaAllowedMenus`를 받아 웹/PDA를 각각 제한하는 구조

## HANES 코드 예시

- 메뉴 설정: `apps/frontend/src/config/menuConfig.ts`
- 웹 사이드바: `apps/frontend/src/components/layout/Sidebar.tsx`
- 헤더: `apps/frontend/src/components/layout/Header.tsx`
- 인증 스토어: `apps/frontend/src/stores/authStore.ts`

## 나쁜 예시

- 각 페이지에서 메뉴를 직접 조건 분기하여 렌더링하는 방식
- 권한 체크를 문자열 라우트 비교만으로 처리하는 방식
- PDA와 웹 메뉴를 같은 권한 배열로 억지로 공유하는 방식

## 적용 체크리스트

1. 메뉴 데이터 구조가 설정 파일로 분리됐는가
2. 메뉴 코드와 라우트 매핑 함수가 있는가
3. 웹과 PDA 권한 배열이 분리됐는가
4. 모바일 오버레이와 데스크톱 접힘 동작이 분리됐는가
5. 사용자 메뉴와 로그아웃 흐름이 헤더에 통합됐는가

## AI 입력 순서에서의 역할

- `ui-screen-patterns.md` 뒤에 읽는다.
- 공통 레이아웃과 메뉴 구조를 생성할 때 기준이 되는 횡단 기능 스펙이다.
