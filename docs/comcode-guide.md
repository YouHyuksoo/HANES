# 공통코드(ComCode) 상세 가이드

## 1. DataGrid 컬럼 - 배지 표시

```tsx
import { ComCodeBadge } from "@/components/ui";

{
  accessorKey: "status",
  header: t("common.status"),
  size: 90,
  cell: ({ getValue }) => (
    <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />
  ),
}
```

## 2. Select 필터 - 드롭다운 옵션

```tsx
import { useComCodeOptions } from "@/hooks/useComCode";

const statusOptions = useComCodeOptions("JOB_ORDER_STATUS");

const filterOptions = useMemo(() => [
  { value: "", label: t("common.allStatus") },
  ...statusOptions,
], [t, statusOptions]);

<Select options={filterOptions} value={filter} onChange={setFilter} />
```

## 3. 모달/텍스트 - 라벨만 필요할 때

```tsx
import { useComCodeLabel } from "@/hooks/useComCode";

const label = useComCodeLabel("PROCESS_TYPE", "CUT");

// 또는 직접 t() 호출
{t(`comCode.CONSUMABLE_CATEGORY.${item.category}`, { defaultValue: item.category })}
```

## 4. 신규 코드그룹 추가 시 체크리스트

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | 시드 데이터에 코드 추가 | `apps/backend/prisma/seed-com-codes.ts` |
| 2 | i18n 번역 추가 (4개 언어) | `apps/frontend/src/locales/{ko,en,zh,vi}.json` |
| 3 | 페이지에서 ComCodeBadge/useComCodeOptions 사용 | 해당 페이지 파일 |
| 4 | 시드 재실행 | `npx prisma db seed` |

## 5. i18n 키 규칙

```json
// 코드명: comCode.{그룹코드}.{상세코드}
"comCode": {
  "PROCESS_TYPE": { "CUT": "절단", "CRIMP": "압착" }
}

// 그룹 설명: comCodeGroup.{그룹코드}
"comCodeGroup": {
  "PROCESS_TYPE": "공정 유형"
}
```

## 6. 다국어 우선순위 (폴백 체인)

```
i18n 번역 (comCode.{group}.{code}) → DB codeName (한국어) → 코드값 그대로
```

## 현재 등록된 주요 코드그룹

| 그룹코드 | 용도 | 코드 예시 |
|----------|------|-----------|
| `PROCESS_TYPE` | 공정유형 | CUT, CRIMP, ASSY, INSP, PACK |
| `JOB_ORDER_STATUS` | 작업지시 상태 | WAIT, RUNNING, PAUSED, DONE |
| `EQUIP_STATUS` | 설비 상태 | NORMAL, MAINT, STOP |
| `EQUIP_TYPE` | 설비 유형 | CUTTING, CRIMPING, ASSEMBLY |
| `WORKER_TYPE` | 작업자 유형 | CUTTING, CRIMPING, ASSEMBLY |
| `PART_TYPE` | 품목 분류 | RAW, WIP, FG |
| `SHIP_ORDER_STATUS` | 출하지시 상태 | DRAFT, CONFIRMED, SHIPPED |
| `INSPECT_JUDGE` | 점검 판정 | PASS, FAIL, CONDITIONAL |
| `JUDGE_YN` | 합격/불합격 | Y, N |
| `CONSUMABLE_CATEGORY` | 소모품 카테고리 | MOLD, JIG, TOOL |
| `CONSUMABLE_STATUS` | 소모품 상태 | NORMAL, WARNING, REPLACE |
