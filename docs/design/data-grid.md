---
sources:
  - apps/frontend/src/components/data-grid/DataGrid.tsx
  - apps/frontend/src/components/shared/StatusBadge.tsx
  - apps/frontend/src/components/ui/ComCodeBadge.tsx
  - apps/frontend/src/app/(authenticated)/master/part/partColumns.tsx
verifiedCommit: 90ecd475
---

# 데이터 그리드 디자인 규칙

TanStack Table v8 기반 공통 `DataGrid`(`components/data-grid/DataGrid.tsx`)와 컬럼 팩토리 파일 30여 개를 그렙으로
전수 확인해 실측했다(예: `partColumns.tsx`, `consumableLifeColumns.tsx`, `moldMgmtColumns.tsx` 등).

## 규칙
| 항목 | 규칙 | 근거 |
|---|---|---|
| 컬럼 팩토리 위치 | 화면별 컬럼 정의는 `page.tsx`에 인라인으로 두지 않고 같은 폴더의 `{domain}Columns.tsx` 파일로 분리해야 한다 | 저장소 전수 그렙: `partColumns.tsx`, `pmPlanColumns.tsx`, `moldMgmtColumns.tsx` 등 30개 이상 동일 패턴 |
| 컬럼 팩토리 함수명 | 팩토리 함수는 `create{Domain}GridColumns(...)` 이름으로 `ColumnDef<T>[]`를 반환하는 함수여야 한다. `t`, 라벨맵, 액션 콜백을 인자로 받는다 | `partColumns.tsx`(`createPartGridColumns`), `consumableLifeColumns.tsx`(`createConsumableLifeGridColumns`) 등 |
| 행 액션 컬럼 | 행 단위 수정/삭제 액션은 첫 컬럼(`id: "actions"`)에 아이콘 버튼으로 둬야 하고 텍스트 버튼으로 바꾸지 않는다 | `partColumns.tsx` L53-83, `master-part-page-standard.md`(행 액션 규칙) |
| 상태/유형 배지 표시 | 상태·유형 컬럼은 문자열을 직접 렌더링하지 말고 `StatusBadge`(`codeType`+`value`)를 사용해야 한다 | `components/shared/StatusBadge.tsx` |
| 배지 색상/라벨 단일출처 | 배지 색상은 `COM_CODES.ATTR1`, 라벨은 i18n 키 `comCode.{groupCode}.{detailCode}`(없으면 DB `codeName` 폴백)만을 유일한 출처로 써야 한다. 화면별로 상태→색상 매핑을 다시 정의하지 않는다 | `ComCodeBadge.tsx` L38-41, `useComCode.ts`(`getLocalizedCodeName`) |
| 배지 색상 셰이드 | 배지 배경색은 `bg-*-{100,200,300,600,700,800,900}` 중에서만 선택해야 하고 `-50` 파스텔 셰이드를 쓰지 않는다(`ComCodeBadge`가 렌더링하는 `attr1` 값 자체가 이 범위로 강제됨) | `globals.css`(`@source inline` safelist), `theme.md` |
| 필터/정렬/내보내기 | 그리드 옵션(컬럼 필터, 내보내기, 전체화면, SQL 조회문)은 `DataGrid`가 통합 제공하는 툴바 하나로 노출해야 하고, 화면마다 별도 버튼 세트를 새로 만들지 않는다 | `DataGrid.tsx` L74-117, L352-445 |
| 컬럼 정렬 방향 | 숫자는 우측, 날짜는 중앙, 문자열은 좌측 정렬을 기본으로 자동 감지해야 하며, 강제할 때만 `meta.align`을 지정한다 | `DataGrid.tsx` L244-260(`detectAlignment`) |

## 사용 컴포넌트/토큰
- 그리드 본체: `apps/frontend/src/components/data-grid/DataGrid.tsx` — 주요 props: `data`, `columns`, `pageSize`, `enableColumnFilter`, `enableExport`, `enableColumnPinning`, `sqlQuery`/`sqlFilters`
- 상태 배지 래퍼: `apps/frontend/src/components/shared/StatusBadge.tsx` — `<StatusBadge codeType="BOX_STATUS" value={row.status} />`
- 실제 렌더러(색상+i18n): `apps/frontend/src/components/ui/ComCodeBadge.tsx` — `<ComCodeBadge groupCode="..." code="..." />`
- 코드 조회 훅: `apps/frontend/src/hooks/useComCode.ts`(`useComCodeItem`, `useComCodeColor`, `useComCodeLabel`)
- 예외 사례: `consumables/label/components/ConLabelColumns.tsx`는 훅 스타일(`useConLabelColumns`)로 예외적으로 구현돼 있다 — 신규 화면은 `create{Domain}GridColumns` 함수 패턴을 기본으로 따른다.

## 금지 (안티패턴)
- 컬럼 정의를 `page.tsx` 안에 인라인 배열로 직접 작성하는 방식.
- 상태값을 컬럼 `cell`에서 `row.status === 'RUNNING' ? '실행중' : ...` 식으로 하드코딩하는 방식 — `StatusBadge`/`comCode.*` i18n 키를 우회한다.
- 화면마다 별도 상태→색상 매핑 객체(`STATUS_COLOR_MAP` 등)를 만들어 DB `ATTR1`과 이중 관리하는 방식.
- 배지에 `bg-*-50` 파스텔 셰이드를 지정하는 방식(safelist 밖이라 실제로는 JIT purge로 사라질 수도 있다).
- 내보내기/필터 버튼을 `DataGrid` 툴바 밖에 화면별로 중복 구현하는 방식.
