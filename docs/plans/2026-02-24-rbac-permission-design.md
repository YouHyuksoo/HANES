# HANES MES 역할/권한 관리 시스템 설계

## 개요
로그인 사용자의 역할(Role) 기반 메뉴 접근 제어 시스템.
하이브리드 방식: 메뉴 정의는 코드, 역할/권한 매핑은 DB.

## 요구사항
- RBAC (역할 기반 접근 제어)
- DB 기반 역할/권한 관리
- 역할 CRUD + 메뉴 권한 매핑 UI
- 권한 없는 메뉴는 비활성화(회색) 처리

## 데이터 구조

### 코드: menuConfig.ts
각 메뉴에 고유 code를 부여하여 정의.
```ts
{ code: "DASHBOARD", path: "/dashboard", i18nKey: "menu.dashboard", parent: null }
{ code: "PRODUCTION", path: null, i18nKey: "menu.production", parent: null }
{ code: "PRODUCTION_INPUT", path: "/production/input", i18nKey: "menu.productionInput", parent: "PRODUCTION" }
```

### DB: ROLES 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| code | VARCHAR UNIQUE | 역할 코드 (ADMIN, MANAGER 등) |
| name | VARCHAR | 역할 표시명 |
| description | VARCHAR NULL | 설명 |
| isSystem | BOOLEAN | true면 삭제 불가 |
| sortOrder | INT | 정렬 순서 |
| company | VARCHAR NULL | 멀티테넌시 |
| plant | VARCHAR NULL | 멀티테넌시 |
| createdAt | TIMESTAMP | |
| updatedAt | TIMESTAMP | |
| deletedAt | TIMESTAMP NULL | 소프트 삭제 |

### DB: ROLE_MENU_PERMISSIONS 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| roleId | UUID FK → ROLES | |
| menuCode | VARCHAR | menuConfig의 code 참조 |
| canAccess | BOOLEAN | 접근 허용 여부 |
| createdAt | TIMESTAMP | |
| updatedAt | TIMESTAMP | |

## 핵심 규칙
- ADMIN 역할: 모든 메뉴 접근 가능 (코드에서 강제)
- isSystem=true 역할: 삭제 불가 (권한 매핑만 변경 가능)
- 매핑 없는 메뉴 = 접근 불가 (화이트리스트 방식)
- User.role 필드: 기존 그대로 사용 (ROLES.code 참조)

## 권한 적용 흐름
1. 로그인 → /api/auth/me → allowedMenus 포함 응답
2. authStore에 allowedMenus 저장
3. Sidebar: menuConfig 순회, allowedMenus에 없으면 비활성화
4. AuthGuard: URL 직접 접근 시 권한 체크

## UI: /system/roles
- 좌측: 역할 목록 (선택 가능)
- 우측: 메뉴 트리 체크박스 (권한 매핑)
- ADMIN 선택 시 모든 체크박스 활성+비활성화(수정불가)

## 변경 범위
| 영역 | 파일 | 변경 |
|------|------|------|
| 신규 | menuConfig.ts | 메뉴 정의 |
| 신규 | role.entity.ts | ROLES 엔티티 |
| 신규 | role-menu-permission.entity.ts | 매핑 엔티티 |
| 신규 | role module/service/controller | CRUD + 매핑 API |
| 신규 | /system/roles/page.tsx | 역할 관리 UI |
| 수정 | authStore.ts | allowedMenus 추가 |
| 수정 | Sidebar.tsx | menuConfig 기반 + 권한 체크 |
| 수정 | AuthGuard.tsx | URL 권한 체크 추가 |
| 수정 | auth.service.ts /me | allowedMenus 포함 |
