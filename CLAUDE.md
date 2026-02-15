# HARNESS MES 프로젝트 설정

## 패키지 매니저

**이 프로젝트는 pnpm을 사용함!**

```json
"packageManager": "pnpm@10.28.1"
```

- npm 사용 금지, 반드시 pnpm 사용
- 명령어: `pnpm install`, `pnpm dev`, `pnpm build`
- Turborepo + pnpm 모노레포 구조

---

## Supabase 연결 체크리스트

**연결 실패 시 반드시 이 순서로 확인할 것!**

### 1. Pooler 주소 확인 (가장 중요!)
- `aws-0` vs `aws-1` 등 숫자가 리전마다 다름
- **절대 추정하지 말고** Supabase Dashboard에서 직접 복사할 것
- Dashboard 경로: Settings > Database > Connection string

### 2. 올바른 연결 문자열 형식
```env
# Transaction pooler (포트 6543) - 일반 쿼리용
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-[N]-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Session pooler (포트 5432) - Migration/Introspection용
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-[N]-[REGION].pooler.supabase.com:5432/postgres"
```

### 3. 체크 포인트
| 항목 | 확인 내용 |
|------|----------|
| aws-N | Dashboard에서 정확한 숫자 확인 (0, 1, 2 등) |
| 리전 | 프로젝트 리전과 일치하는지 (ap-northeast-2 등) |
| 포트 | Transaction=6543, Session=5432 |
| pgbouncer | Transaction pooler는 `?pgbouncer=true` 필수 |

### 4. 현재 프로젝트 정보
- **Project ID**: `YOUR_PROJECT_REF`
- **Project Name**: `harness-mes`
- **Region**: `ap-northeast-2`
- **Pooler 주소**: `YOUR_POOLER_HOST`

---

## UI 규칙

- **`alert()`, `confirm()`, `prompt()` 사용 금지** — 브라우저 네이티브 다이얼로그 대신 반드시 Modal/ConfirmModal 컴포넌트 사용
- 성공/실패/경고 메시지는 모두 Modal 또는 toast로 표시
- 통계 카드는 반드시 공통 `StatCard` 컴포넌트(`@/components/ui`) 사용

---

## 공통코드(ComCode) 적용 가이드

**신규 페이지를 만들 때, 코드값을 표현하는 컬럼은 반드시 공통코드 시스템을 사용할 것!**

### 핵심 원칙

- 하드코딩된 한국어 라벨/색상 **절대 금지**
- 모든 코드성 데이터는 `ComCodeBadge` + `useComCodeOptions`로 통일
- 다국어(ko/en/zh/vi)는 i18n 파일에서 자동 처리됨

### 1. DataGrid 컬럼 — 배지 표시

```tsx
import { ComCodeBadge } from "@/components/ui";

// 컬럼 정의
{
  accessorKey: "status",
  header: t("common.status"),
  size: 90,
  cell: ({ getValue }) => (
    <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />
  ),
}
```

### 2. Select 필터 — 드롭다운 옵션

```tsx
import { useComCodeOptions } from "@/hooks/useComCode";

const statusOptions = useComCodeOptions("JOB_ORDER_STATUS");
// → [{ value: "WAIT", label: "대기" }, { value: "RUNNING", label: "진행중" }, ...]

// "전체" 옵션 포함
const filterOptions = useMemo(() => [
  { value: "", label: t("common.allStatus") },
  ...statusOptions,
], [t, statusOptions]);

<Select options={filterOptions} value={filter} onChange={setFilter} />
```

### 3. 모달/텍스트 — 라벨만 필요할 때

```tsx
import { useComCodeLabel } from "@/hooks/useComCode";

// 훅 사용
const label = useComCodeLabel("PROCESS_TYPE", "CUT");
// → "절단" (ko) / "Cutting" (en)

// 또는 직접 t() 호출
{t(`comCode.CONSUMABLE_CATEGORY.${item.category}`, { defaultValue: item.category })}
```

### 4. 신규 코드그룹 추가 시 체크리스트

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | 시드 데이터에 코드 추가 | `apps/backend/prisma/seed-com-codes.ts` |
| 2 | i18n 번역 추가 (4개 언어) | `apps/frontend/src/locales/{ko,en,zh,vi}.json` |
| 3 | 페이지에서 ComCodeBadge/useComCodeOptions 사용 | 해당 페이지 파일 |
| 4 | 시드 재실행 | `npx prisma db seed` |

### 5. i18n 키 규칙

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

### 6. 다국어 우선순위 (폴백 체인)

```
i18n 번역 (comCode.{group}.{code}) → DB codeName (한국어) → 코드값 그대로
```

### 현재 등록된 주요 코드그룹

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

---

## Prisma 작업 순서

```bash
# 1. 스키마 가져오기 (Supabase에서)
npx prisma db pull

# 2. Client 생성 (필수!)
npx prisma generate

# 3. 서버 재시작
pnpm dev
```
