---
title: 사용자 즐겨찾기 폴더
sources:
  - apps/backend/src/modules/menu-favorites/controllers/menu-favorites.controller.ts
  - apps/backend/src/modules/menu-favorites/services/menu-favorites.service.ts
  - apps/backend/src/modules/menu-favorites/dto/menu-favorite.dto.ts
  - apps/backend/src/entities/user-menu-favorite-folder.entity.ts
  - apps/backend/src/entities/user-menu-favorite.entity.ts
  - apps/backend/src/migrations/2026-09-08_menu_favorite_folders.sql
verifiedCommit: 848af61b
---

# 사용자 즐겨찾기 폴더

2026-09-08 작업트리 기준. 폴더는 1단계이며 회사·사업장·사용자 이메일별로 독립한다.

| API | 동작 |
| --- | --- |
| GET /menu-favorites/me | 기존 메뉴코드 배열 유지 |
| PUT /menu-favorites/me | 배열 순서 동기화. 남은 메뉴의 폴더 할당은 보존 |
| GET /menu-favorites/folders | folders(id, name, sortOrder), assignments(menuCode, folderId) |
| POST /menu-favorites/folders | name을 trim하여 생성. Oracle SEQUENCE.NEXTVAL 채번 |
| PATCH /menu-favorites/folders/:id | 내 폴더 이름 변경 |
| DELETE /menu-favorites/folders/:id | 소속 메뉴를 루트(null)로 이동하고 폴더 삭제. 하나의 트랜잭션 |
| PUT /menu-favorites/me/:menuCode/folder | 이미 즐겨찾기인 메뉴의 폴더 변경. null이면 루트 |

`USER_MENU_FAVORITE_FOLDERS`는 폴더 소유자와 이름을 저장한다. `USER_MENU_FAVORITES.FOLDER_ID`는 nullable이며 기존 즐겨찾기는 모두 루트로 유지한다. 복합 FK는 회사·사업장·사용자 이메일까지 묶어 다른 소유자의 폴더를 참조하지 못하게 한다. 삭제·이름변경·이동은 소유자 범위로 폴더를 잠그고 처리한다.

변경 시 위 sources의 DTO → controller → service → entity → migration 전체와 sidebar의 API 소비부를 함께 확인한다. DB 구조 변경 후 `ORACLE_SITE=JSHANES`로 `tools/generate_db_schema_doc.py`를 실행한다.

검증: `menu-favorite-folders.service.spec.ts` 및 기존 menu-favorites 테스트 16건, backend typecheck 통과. JSHANES에서 소유자 FK 거부와 폴더 삭제 후 메뉴 유지 SQL을 실제 실행하고 QA 데이터는 rollback했다. 인증 API/브라우저 검증은 상위 통합 검증 결과에 따른다.
