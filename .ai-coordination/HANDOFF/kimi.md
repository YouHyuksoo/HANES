# kimi Handoff

## Last Update

2026-06-23 20:46

## Active Work

- `T-CONS-MOUNT-SQL-PREVIEW` `/consumables/mount` DataGrid SQL 미리보기 실제 조회 구조 반영 완료.
  - `apps/frontend/src/app/(authenticated)/consumables/mount/page.tsx`의 `DataGrid.sqlQuery`를 `CONSUMABLE_MASTERS` 기준 실제 조회 SQL로 교체.
  - `GET /equipment/consumables` → `ConsumableService.findAll()`의 `COMPANY`/`PLANT_CD`, `CATEGORY`, 검색어(`CONSUMABLE_CODE`, `NAME`), `ORDER BY CONSUMABLE_CODE ASC`, `OFFSET/FETCH` 구문 반영.

## Completed

- `T-CONS-MOUNT-HELP-LOCALE` `/consumables/mount` 도움말 및 다국어 처리 완료.
- `T-CONS-MOUNT-SQL-PREVIEW` `/consumables/mount` SQL 미리보기 보정 완료.
- 프론트엔드 typecheck 및 `git diff --check` 통과.

## Next AI Should

1. `T-CONS-MOUNT-SQL-PREVIEW` 완료 후 `TASKS.md`/`LOCKS.md`에서 해당 항목 제거 및 `ARCHIVE.md` 기록.
2. `/consumables/mount` 화면의 `operStatus` 필터가 백엔드에 적용되지 않는 문제(`params.operStatus` 전송 vs `ConsumableQueryDto.status` 수신)를 별도 작업으로 검토/수정.
