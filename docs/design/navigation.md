---
sources:
  - apps/frontend/src/config/menuConfig.ts
  - apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
  - apps/backend/src/seeds/menu-config.json
  - docs/standards/menu-add-workflow.md
verifiedCommit: 08949e5b
---

# 내비게이션 디자인 규칙

`menuConfig.ts`(프론트 사이드바 정의), `menu-code-validator.ts`(백엔드 화이트리스트), `menu-config.json`(권한 시드)을
실측했다. 메뉴 추가는 여러 파일에 걸친 명시적 등록이 필요하며 자동 동기화는 없다.

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|
| 메뉴 데이터 구조 | 사이드바는 하드코딩 JSX가 아니라 `MenuConfigItem[]` 설정 배열(`code`, `labelKey`, `path?`, `icon?`, `children?`)로 정의해야 한다 | `menuConfig.ts` L18-29 |
| 카테고리 구조 | 최상위 항목(`icon` 보유)은 카테고리이고, 실제 라우트가 있는 leaf는 `children` 배열 안에만 존재해야 한다. 최상위에 직접 `path`를 주는 예외는 `DASHBOARD`, `WORKFLOW`처럼 카테고리 없이 단독 메뉴인 경우로 한정한다 | `menuConfig.ts` L33-44(단독) vs L53-74(카테고리+children) |
| 메뉴 코드 규칙 | `code`는 대문자+언더스코어이며 도메인 prefix를 써야 한다(`MAT_*`, `QC_*`, `PROD_*`, `SYS_*` 등) | `menuConfig.ts` 전체, `menu-add-workflow.md` 2단계 |
| 메뉴 추가 시 동시 수정 대상 | 새 leaf 메뉴 추가 시 다음 곳을 **모두** 동시에 수정해야 한다: (1) `menuConfig.ts`의 해당 카테고리 `children` (2) `menu-code-validator.ts`의 `KNOWN_LEAF_CODES` (3) 필요 시 `menu-config.json`의 `childMenuCodes` (4) `MENU_CATEGORY_ITEMS` 테이블에 DB MERGE/INSERT. 하나라도 누락하면 사이드바 미노출 또는 권한 API 거부로 이어진다 | `menu-add-workflow.md` 2-6단계, `menu-code-validator.ts` L1-10(파일 상단 설명) |
| i18n 동시 반영 | `labelKey`는 `locales/{ko,en,zh,vi}.json` 4개 파일에 동시 추가해야 한다. 누락 시 사이드바에 키 문자열이 그대로 노출된다 | `menu-add-workflow.md` 4단계 |
| 자동 동기화 금지 | `menuConfig.ts`와 DB `MENU_CATEGORY_ITEMS`의 동기화는 의도적으로 자동화하지 않는다 — 검증 가능한 변경 흔적을 남기기 위해 개발자가 두 곳을 명시적으로 수정해야 한다 | `menu-add-workflow.md`(자동 동기화는 하지 않는 이유) |
| 유틸 함수 재사용 | 메뉴 코드-경로 매핑은 화면마다 직접 순회하지 말고 `getAllMenuCodes`, `findMenuCodeByPath`, `findMenuItemByPath`, `getParentCodes`를 재사용해야 한다 | `menuConfig.ts` L342-417 |

## 사용 컴포넌트/토큰
- 메뉴 설정: `apps/frontend/src/config/menuConfig.ts`
- 백엔드 leaf 화이트리스트: `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts`(`KNOWN_LEAF_CODES`)
- 권한 시드 소스: `apps/backend/src/seeds/menu-config.json`(`topMenuCodes`, `childMenuCodes`) — `seed-roles.ts`가 멱등 처리
- 전체 절차 표준 문서: **`docs/standards/menu-add-workflow.md`**(라우트 생성 → menuConfig → 백엔드 화이트리스트 → i18n → DB MERGE → 시드 재실행 → 빌드 검증까지 7단계 전체 절차)
- 사이드바/헤더 상세 스펙: `docs/standards/navigation-spec.md`(권한 모델, 반응형, 접근성 규칙)

## 금지 (안티패턴)
- `menuConfig.ts`만 수정하고 `menu-code-validator.ts`의 `KNOWN_LEAF_CODES`를 갱신하지 않는 방식 — `MENU_CATEGORY_ITEMS` 이동/배치 API가 거부한다.
- i18n 4개 언어 파일 중 일부만 갱신하는 방식.
- DB `MENU_CATEGORY_ITEMS`와 `menuConfig.ts`를 자동 스크립트로 동기화하려는 시도 — 운영 정책상 금지(명시적 이중 수정이 의도된 설계).
- 화면 컴포넌트에서 메뉴 트리를 직접 순회/조건 분기해 렌더링하는 방식 — 공통 유틸 함수를 우회한다.
