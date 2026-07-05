---
sources:
  - apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts
  - apps/frontend/src/config/menuConfig.ts
verifiedCommit: 2e8d7f56
---

# 새 페이지/메뉴 추가 워크플로우

좌측 사이드바에 새 메뉴 항목을 추가할 때 반드시 다음 단계를 모두 수행한다.

## 단계

1. **페이지 라우트 파일 생성**
   - `apps/frontend/src/app/(authenticated)/.../page.tsx` 를 만든다.

2. **`menuConfig.ts`에 leaf 추가**
   - `apps/frontend/src/config/menuConfig.ts` 의 적절한 카테고리 `children` 배열에 추가한다.
   ```ts
   { code: 'NEW_MENU_CODE', labelKey: 'menu.xxx.newPage', path: '/xxx/new-page' }
   ```
   - `code`는 영문 대문자/숫자/언더스코어, 도메인 prefix 사용 (예: `MAT_*`, `QC_*`, `SYS_*`).

3. **백엔드 leaf 코드 화이트리스트 갱신**
   - `apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts` 의 `KNOWN_LEAF_CODES` Set에 `'NEW_MENU_CODE'` 추가.
   - 이 화이트리스트가 `MENU_CATEGORY_ITEMS` 이동/배치 API의 유효성 검증에 쓰인다.

4. **i18n 4파일에 라벨 추가**
   - `apps/frontend/src/locales/{ko,en,zh,vi}.json` 모두에 `labelKey` 항목을 동시 추가한다.
   - 누락 시 사이드바에 키 이름 그대로 노출되므로 4개 언어 모두 채울 것.

5. **`MENU_CATEGORY_ITEMS` 배치 SQL 작성 + 적용**
   - 마이그레이션 SQL 또는 일회성 INSERT로 JSHANES에 적용한다.
   ```sql
   INSERT INTO MENU_CATEGORY_ITEMS
     (MENU_CODE, CATEGORY_CODE, SORT_ORDER, COMPANY, PLANT_CD,
      CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY)
   VALUES
     ('NEW_MENU_CODE', 'MASTER', 160, 'HANES', '-',
      SYSTIMESTAMP, 'system', SYSTIMESTAMP, 'system');
   COMMIT;
   ```
   - 적용 후 관리 화면에서 드래그앤드롭으로 순서/소속을 자유롭게 조정 가능.

6. **`ROLE_MENU_PERMISSIONS` 시드 갱신 (필요 시)**
   - `apps/backend/src/seeds/menu-config.json` 의 `childMenuCodes` 적절한 카테고리에 `'NEW_MENU_CODE'` 추가.
   - `cd apps/backend && npx ts-node src/seeds/seed-roles.ts` 재실행.
   - 멱등성 시드 — 기존 권한은 보존되고 새 코드만 추가됨.

7. **검증**
   - `pnpm --filter frontend build` 와 `pnpm --filter backend build` 가 0 에러여야 한다.
   - 사이드바에서 새 메뉴가 의도한 카테고리에 표시되는지 확인.

## 자동 동기화는 하지 않는 이유

`menuConfig.ts` 와 `MENU_CATEGORY_ITEMS` 의 동기화는 운영 정책상 자동화하지 않는다.
- 개발자가 명시적으로 두 곳을 수정하면 검증 가능한 변경 흔적이 남는다.
- DB 시드 누락 시 백엔드 부팅 시 콘솔 경고로 알린다 (BLOCKING 아님).
- 관리자가 화면에서 의도한 자리로 옮기는 작업 흐름을 유지한다.

## 관련 문서

- 설계: [`../specs/2026-05-18-menu-category-management-design.md`](../specs/2026-05-18-menu-category-management-design.md)
- 구현 계획: [`../plans/2026-05-18-menu-category-management.md`](../plans/2026-05-18-menu-category-management.md)
- 네비게이션 스펙: [`../standards/navigation-spec.md`](../standards/navigation-spec.md)
