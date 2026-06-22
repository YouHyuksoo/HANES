# 좌측 메뉴 카테고리/순서 관리 기능 설계

- 작성일: 2026-05-18
- 작성자: hsyou
- 상태: Draft (오빠 검토 대기)
- 관련 문서: `docs/standards/navigation-spec.md`, `docs/standards/common-code-guide.md`

## 1. 배경과 목적

현재 좌측 사이드바 메뉴는 `apps/frontend/src/config/menuConfig.ts`에 9개 카테고리와 그 하위 메뉴들이 하드코딩되어 있다. 메뉴의 표시 순서, 서브메뉴의 소속 카테고리를 바꾸려면 매번 개발자가 코드를 수정하고 배포해야 한다.

이 문서는 **카테고리(상위 메뉴)와 메뉴 배치(어느 카테고리의 몇 번째 위치)를 시스템 관리자가 화면에서 직접 관리**할 수 있도록 데이터 모델, API, 관리 화면, 마이그레이션, 검증 기준을 정의한다.

## 2. 범위와 결정 사항

### 2.1 결정된 사항 (브레인스토밍 합의)

| 항목 | 결정 |
|---|---|
| 관리 주체 | **시스템 관리자 전역 설정** (역할별/사용자별 개인화 없음) |
| 관리 가능 범위 | **카테고리 순서 변경 + 메뉴 소속 변경 + 카테고리 추가/삭제**. 단, 메뉴(leaf) 자체의 정의(code/path/labelKey)는 코드에 정의된 것만 사용 |
| 카테고리 아이콘 | 기존 9개 카테고리는 코드의 lucide 아이콘 유지. 신규 카테고리는 기본 폴더 아이콘 또는 lucide 아이콘 이름을 직접 입력 |
| 다국어 | i18n key 방식 유지. 신규 카테고리도 `LABEL_KEY` 부여 후 ko/en/zh/vi 4파일에 개발자가 직접 추가 |
| 관리 UI | 하이브리드 (드래그앤드롭 트리 + 우측 FormPanel) |
| 신규 페이지 등록 | 자동 동기화 없음. 개발자가 `menuConfig.ts` 추가 + 마이그레이션 SQL 한 줄을 함께 작성 |
| 페이지(leaf) 정의 위치 | `menuConfig.ts`에 그대로 유지. DB는 카테고리와 배치만 관리 |
| 카테고리 삭제 정책 | 비어있을 때만 삭제 허용. 메뉴가 있으면 409 + 한국어 안내 |
| 단독 메뉴 처리 | 예약 카테고리 `__ROOT__`에 매핑하여 최상위 표시 (DASHBOARD, WORKFLOW 등) |
| 권한 모델 | `ROLE_MENU_PERMISSIONS`의 `MENU_CODE` 기반 RBAC 그대로 유지. 카테고리는 표시 그룹이므로 권한 코드 없음 |

### 2.2 범위 외

- 역할별/사용자별 메뉴 개인화
- 메뉴(leaf) 정의의 DB 이전 (code/path/labelKey의 화면 편집)
- 카테고리 별도 권한 부여 (자식 권한 합계로 결정)
- PDA 메뉴 구조 변경 (현재 `pdaMenuConfig.ts` 그대로)

## 3. 데이터 모델

### 3.1 `MENU_CATEGORIES` — 카테고리 정의

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `CATEGORY_CODE` | VARCHAR2(50) | PK | 카테고리 코드. `^[A-Z][A-Z0-9_]{1,49}$`. 예약어: `__ROOT__` |
| `LABEL_KEY` | VARCHAR2(200) | NOT NULL | i18n 키 (예: `menu.master`) |
| `ICON_NAME` | VARCHAR2(50) | NULL | lucide-react 아이콘 이름. NULL이면 기본 폴더 아이콘 |
| `SORT_ORDER` | NUMBER(10) | NOT NULL DEFAULT 0 | 사이드바 최상위 표시 순서 (10단위 권장) |
| `IS_ACTIVE` | CHAR(1) | NOT NULL DEFAULT 'Y' | 'N'이면 사이드바에서 숨김 |
| `COMPANY` | VARCHAR2(20) | NOT NULL | 멀티테넌시 — 회사 |
| `PLANT_CD` | VARCHAR2(20) | NOT NULL | 멀티테넌시 — 사업장 |
| `CREATED_AT` | TIMESTAMP | NOT NULL | 표준 감사 |
| `CREATED_BY` | VARCHAR2(50) | NOT NULL | 표준 감사 |
| `UPDATED_AT` | TIMESTAMP | NOT NULL | 표준 감사 |
| `UPDATED_BY` | VARCHAR2(50) | NOT NULL | 표준 감사 |

- 인덱스: `IDX_MENU_CATEGORIES_SCOPE (COMPANY, PLANT_CD, SORT_ORDER)`
- 멀티테넌시: 1차 적용은 단일 세트(전역). 컬럼은 두되 동일 값 사용. 필요 시 확장.

### 3.2 `MENU_CATEGORY_ITEMS` — 메뉴 ↔ 카테고리 배치

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `MENU_CODE` | VARCHAR2(100) | PK | menuConfig.ts의 leaf `code` |
| `CATEGORY_CODE` | VARCHAR2(50) | NOT NULL FK→MENU_CATEGORIES | 소속 카테고리 |
| `SORT_ORDER` | NUMBER(10) | NOT NULL DEFAULT 0 | 카테고리 내 표시 순서 |
| `COMPANY` | VARCHAR2(20) | NOT NULL | 멀티테넌시 |
| `PLANT_CD` | VARCHAR2(20) | NOT NULL | 멀티테넌시 |
| `CREATED_AT`, `CREATED_BY`, `UPDATED_AT`, `UPDATED_BY` | | NOT NULL | 표준 감사 |

- 인덱스: `IDX_MCI_CATEGORY (CATEGORY_CODE, SORT_ORDER)`
- FK: `CATEGORY_CODE → MENU_CATEGORIES.CATEGORY_CODE` ON DELETE RESTRICT
- 멀티테넌시 스코프는 1차 단일 세트.

### 3.3 정합성 규칙

- `MENU_CATEGORY_ITEMS.MENU_CODE`는 코드의 menuConfig leaf에 존재해야 한다. 미일치 시 앱 부팅 시 콘솔 경고(런타임 차단 안 함).
- menuConfig에 있지만 어디에도 매핑 안 된 leaf는 관리 화면 "미배치 메뉴" 트레이에 노출된다.
- 카테고리 삭제는 안에 메뉴(`MENU_CATEGORY_ITEMS` 행)가 없을 때만 허용한다.
- 예약 카테고리 `__ROOT__`는 시드 시 1행 생성, 화면에서 삭제/이름 변경 불가. DASHBOARD/WORKFLOW 같은 단독 메뉴를 여기에 매핑하여 최상위 표시.

## 4. 아키텍처와 렌더링 흐름

```
┌─ App 시작 ─────────────────────────────────────────────┐
│                                                        │
│  코드 menuConfig.ts        DB MENU_CATEGORIES          │
│  (leaf 정의)                DB MENU_CATEGORY_ITEMS     │
│       │                          │                     │
│       └──────────┬───────────────┘                     │
│                  ▼                                     │
│   GET /menu-categories/tree                            │
│   (백엔드가 카테고리 + 배치된 메뉴 코드 목록 반환)        │
│                  │                                     │
│                  ▼                                     │
│   프론트: zustand useMenuTreeStore에서                  │
│   - 카테고리 = DB 응답                                  │
│   - children = MENU_CODE 를 menuConfig leaf로 lookup    │
│   - sort_order 정렬                                    │
│   - __ROOT__ 매핑은 사이드바 최상위로 평탄화             │
│                  │                                     │
│                  ▼                                     │
│   authStore.allowedMenus 로 필터링                      │
│   - 카테고리는 자식 중 1개라도 허용이면 표시              │
│                  │                                     │
│                  ▼                                     │
│   <Sidebar /> 렌더                                     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- 로딩 중에는 코드의 `menuConfig` 사용(FOUC 방지 fallback). API 응답 도착 후 머지된 트리로 교체.

## 5. 백엔드 API

NestJS 모듈: `apps/backend/src/modules/menu-categories/`

### 5.1 조회

| 메서드 · 경로 | 설명 |
|---|---|
| `GET /menu-categories/tree` | 사이드바 렌더용. 카테고리 + 각 카테고리에 배치된 `MENU_CODE` 목록 (sort_order 적용). 캐싱 대상. |
| `GET /menu-categories` | 카테고리 CRUD 화면 목록 |
| `GET /menu-categories/unassigned-menus` | 어디에도 배치되지 않은 menuConfig leaf 코드 목록 |

### 5.2 카테고리 CRUD

| 메서드 · 경로 | 설명 |
|---|---|
| `POST /menu-categories` | 신규 카테고리. body: `{code, labelKey, iconName?}`. code 유효성 검증, 중복 차단. |
| `PATCH /menu-categories/:code` | 라벨키 / 아이콘 / 활성 여부 / 순서 수정. `__ROOT__`는 활성 여부와 라벨키 수정 차단. |
| `DELETE /menu-categories/:code` | 빈 카테고리만 삭제 허용. 차있으면 409 + 한국어 메시지. `__ROOT__`는 삭제 차단. |

### 5.3 순서 · 소속 변경

| 메서드 · 경로 | 설명 |
|---|---|
| `PATCH /menu-categories/reorder` | 카테고리 자체 순서 일괄 갱신. body: `[{code, sortOrder}, ...]`. 트랜잭션. |
| `PATCH /menu-categories/:code/items` | 카테고리 내 메뉴 순서 일괄 갱신. body: `[{menuCode, sortOrder}, ...]`. |
| `PATCH /menu-category-items/move` | 메뉴 1개를 다른 카테고리로 이동. body: `{menuCode, toCategoryCode, sortOrder}`. |

### 5.4 검증

- `CATEGORY_CODE` 유효성: `^[A-Z][A-Z0-9_]{1,49}$` (DTO 레벨 + 서비스 레벨 중복 차단)
- `MENU_CODE`는 코드 menuConfig에 존재하는 leaf 코드여야 함 (배치 API에서 차단)
- 카테고리 삭제 시 자식 존재 → 409 한국어 메시지: "카테고리에 메뉴가 N개 있습니다. 먼저 다른 카테고리로 이동하거나 삭제해주세요"
- 모든 변경 API는 트랜잭션(`@Transaction` 또는 QueryRunner)

### 5.5 캐싱

- `GET /menu-categories/tree`는 사이드바 매 로드마다 호출되므로 NestJS 인메모리 캐시 (TTL 60초)
- write 작업 성공 시 invalidate
- 프론트는 zustand store에 보관, 관리 화면 변경 시 재요청

### 5.6 권한

- 관리 API(`POST/PATCH/DELETE`)는 `@MenuCode('SYS_MENU_CATEGORY')` 가드 적용
- `GET /menu-categories/tree`는 인증된 사용자 누구나 호출 가능

## 6. 관리 화면 UI

### 6.1 라우트와 권한

- 경로: `/system/menu-categories`
- 메뉴 코드: `SYS_MENU_CATEGORY`
- 시드: `ROLE_MENU_PERMISSIONS`에 ADMIN만 허용으로 추가
- menuConfig.ts에 leaf 등록 (SYSTEM 또는 ADMINISTRATION 계열 카테고리에 매핑)

### 6.2 레이아웃

HANES 표준 패턴 — DataGrid + FormPanel + 드래그앤드롭 트리 하이브리드.

```
┌────────────────────────────────────────────────────────────────────┐
│ 메뉴 카테고리 관리                            [+ 카테고리 추가]     │
├────────────────────────────────────────────────────────────────────┤
│ ┌─ 메뉴 트리 (좌측, flex-1) ──────┐  ┌─ 편집 패널 (우측, 380px) ─┐ │
│ │ 📁 대시보드 (__ROOT__)          │  │ 카테고리 코드: MASTER     │ │
│ │ 📁 워크플로우 (__ROOT__)         │  │ i18n 키: menu.master      │ │
│ │ ▼ 📂 마스터       ⋮⋮            │  │ 아이콘: Database ▾        │ │
│ │    • 자재 마스터    ⋮⋮          │  │ 활성: [ON]                │ │
│ │    • BOM           ⋮⋮           │  │ 순서: 30                  │ │
│ │ ▼ 📂 자재 재고     ⋮⋮           │  │                          │ │
│ │ ▶ 📂 제품 재고     ⋮⋮           │  │ [저장] [삭제(비활성)]      │ │
│ │ …                              │  │                          │ │
│ │ ─────────────────────────       │  │                          │ │
│ │ 📋 미배치 메뉴 (3)              │  │                          │ │
│ │    • 신규 페이지A   ⋮⋮          │  │                          │ │
│ └─────────────────────────────────┘  └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 6.3 인터랙션

- **드래그앤드롭** (`@dnd-kit/core` + `@dnd-kit/sortable` 사용 — 의존성 추가 필요)
  - 카테고리 ↕ 카테고리: `PATCH /menu-categories/reorder`
  - 메뉴 → 다른 카테고리: `PATCH /menu-category-items/move`
  - 미배치 영역 → 카테고리: 매핑 신규 생성 (`MENU_CATEGORY_ITEMS` INSERT)
  - 카테고리 → 미배치 영역: 매핑 삭제 (`MENU_CATEGORY_ITEMS` DELETE) → 해당 메뉴는 사이드바에서 보이지 않음
  - 최상위(루트)에 표시하려면 `__ROOT__` 카테고리로 이동
- **상태 정의**:
  - "미배치 메뉴" = `MENU_CATEGORY_ITEMS`에 행이 없는 leaf 메뉴 (코드엔 존재하지만 사이드바에 표시되지 않음)
  - "단독 메뉴" = `__ROOT__` 카테고리에 매핑된 메뉴 (사이드바 최상위에 카테고리 그룹 없이 표시)
- **클릭**:
  - 카테고리 클릭 → 우측 카테고리 편집 폼
  - 메뉴(leaf) 클릭 → 우측 메뉴 정보 read-only + "소속 변경" 셀렉트 (드롭다운 대안)
- **[+ 카테고리 추가]** → 우측 패널이 신규 폼으로 전환. `FormPanel key` prop 패턴 적용(잔류 차단)
- **[삭제]** 버튼은 빈 카테고리일 때만 활성. 차있으면 비활성 + 툴팁 안내

### 6.4 Read-only 표시 (메뉴 leaf 클릭 시)

- 표시: `code`, `path`, `labelKey`, 현재 소속 카테고리
- 변경 가능: 소속 카테고리만
- 안내 문구: "이 메뉴는 코드(`menuConfig.ts`)에 정의되어 있어 라벨/경로는 코드에서만 변경할 수 있습니다."

### 6.5 사이드바 변경

- `apps/frontend/src/components/layout/Sidebar.tsx`: `menuConfig` 직접 import 제거 → `useMenuTreeStore`에서 머지된 트리 사용
- 로딩 fallback: 트리 도착 전까지 코드 `menuConfig` 사용
- `authStore.allowedMenus` 필터링 로직과 카테고리 자식 권한 합계 로직은 그대로 유지

## 7. 마이그레이션과 초기 시드

### 7.1 DDL

`scripts/migrations/<실제 적용일>_create_menu_categories.sql` (사이트: `JSHANES`)
실제 마이그레이션 PR에서는 작성일 기준의 `YYYY-MM-DD` 접두사로 파일명을 확정한다.

- `MENU_CATEGORIES`, `MENU_CATEGORY_ITEMS` 생성
- 인덱스, FK 생성
- 롤백 SQL 동봉: 동일 날짜 접두사 + `_rollback.sql`

### 7.2 시드 데이터

자동 생성 스크립트: `scripts/gen-menu-category-seed.js`
- `menuConfig.ts` 파싱 → SQL INSERT 생성
- 카테고리: 현재 9개 그대로 (`MASTER`, `MONITORING`, `INVENTORY`, ...) + `__ROOT__` 1개
- `LABEL_KEY`, `ICON_NAME`은 menuConfig에서 그대로 추출
- `SORT_ORDER`는 menuConfig 배열 순서 기준 10단위(10, 20, 30...)
- 메뉴 배치: children 평탄화 → 부모 카테고리에 매핑. 단독 메뉴(`DASHBOARD`, `WORKFLOW`)는 `__ROOT__`에 매핑.

### 7.3 일관성 가드 (앱 부팅 시)

- 백엔드 부팅 시 1회 실행되는 자가진단:
  - `MENU_CATEGORY_ITEMS.MENU_CODE` 중 코드 menuConfig에 없는 코드 → 콘솔 경고 (차단 안 함)
  - menuConfig에 있는데 매핑 없는 leaf → 콘솔 경고 (관리 화면 "미배치 메뉴"에 자동 노출)

### 7.4 새 페이지 추가 워크플로우 (개발자용)

문서: `docs/workflows/menu-add-workflow.md` 추가

```
1. 페이지 라우트 파일 생성
   apps/frontend/src/app/(authenticated)/.../page.tsx

2. menuConfig.ts에 leaf 추가
   { code: 'NEW_MENU_CODE', labelKey: 'menu.xxx.newPage', path: '/xxx/new-page' }

3. i18n 4개 파일에 labelKey 추가 (ko/en/zh/vi)

4. 마이그레이션 SQL 작성
   INSERT INTO MENU_CATEGORY_ITEMS
     (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD, CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
   VALUES
     ('NEW_MENU_CODE', 'MASTER', 160, ..., ..., SYSDATE, 'system', SYSDATE, 'system');

5. ROLE_MENU_PERMISSIONS에 기본 권한 시드 추가 (필요 시)

6. pnpm build 검증 후 PR
```

## 8. 검증 기준

### 8.1 백엔드 단위 테스트 (`*.service.spec.ts`)

- `menu-categories.service.spec.ts`
  - CRUD 정상 동작
  - 빈 카테고리만 삭제 허용
  - 코드 유효성 검증 (`^[A-Z][A-Z0-9_]{1,49}$`)
  - 카테고리 reorder 트랜잭션
  - `__ROOT__` 삭제 차단
- `menu-category-items.service.spec.ts`
  - 메뉴 이동 정상 동작
  - 카테고리 내 sort_order 일괄 갱신
  - 존재하지 않는 메뉴 코드 차단

### 8.2 수동 API 검증 (curl)

- `GET /menu-categories/tree` 응답 구조와 정렬 확인
- 카테고리 삭제 시 409 + 한국어 메시지
- 메뉴 이동 후 tree 재조회 → 위치 변경 반영
- 권한 없는 사용자가 관리 API 호출 → 403

### 8.3 프론트 검증

- `pnpm build` 0 에러
- 사이드바 시각적 회귀 0건 (시드 적용 후 기존과 동일)
- 관리 화면에서 카테고리 추가/순서 변경 후 사이드바에 반영
- i18n 키 누락 시 키 그대로 노출 (폴백 동작)
- 다크 모드 정상 (관리 화면 폼/트리)

### 8.4 시드 회귀 검증 (성공 기준)

- DDL + 시드 적용 → 기존 사이드바와 시각적으로 100% 동일해야 한다 (사용자 입장에서 차이 없음)

## 9. 위험과 완화

| 위험 | 완화 |
|---|---|
| 기존 카테고리 코드(`MASTER` 등)가 `ROLE_MENU_PERMISSIONS`에 권한 코드로도 등록되어 있을 가능성 | 구현 시 실 DB 확인. 권한 코드는 그대로 두고 의미만 분리 (메뉴 코드는 leaf만, 카테고리 코드는 표시 그룹) |
| `@dnd-kit/*` 의존성 미설치 | 의존성 추가 PR을 첫 단계에 포함. 번들 크기 영향 작음 (~10KB gzip) |
| 시드 누락 또는 마이그레이션 실패로 빈 트리 응답 | 프론트 로딩 fallback이 코드 `menuConfig` 사용. 트리 응답이 빈 배열이면 콘솔 경고 + fallback |
| 멀티테넌시 확장 시 데이터 분기 누락 | 컬럼은 처음부터 두되 1차는 단일 세트. 확장 시 별도 마이그레이션으로 회사·사업장 분기 시드 추가 |

## 10. 다음 단계

- 본 스펙 오빠 검토 → 확정
- `writing-plans` 스킬로 구현 계획 작성 (마이그레이션 → 백엔드 모듈 → 프론트 store → 관리 화면 → 사이드바 연동 → 검증)
