# 출고계정(Issue Account) 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 자재 불출 시 출고계정(양산, 불량, 샘플, 설계시작, 재고조정, 로스 등)을 ComCode 기반으로 관리하고, 모든 출고 방식에서 필수 선택하도록 한다.

**Architecture:** 기존 하드코딩된 `ISSUE_TYPE_VALUES` 상수를 ComCode 테이블의 `ISSUE_TYPE` 그룹으로 전환. 프론트엔드에서 `useComCodeOptions`로 동적 조회하며, `issueType`을 모든 출고에서 필수 입력으로 변경.

**Tech Stack:** NestJS (백엔드), Next.js + React (프론트엔드), TypeORM, Oracle DB (JSHANES), useComCodeOptions/ComCodeBadge

---

### Task 1: ComCode seed 데이터 추가 (ISSUE_TYPE 그룹)

**Files:**
- Create: `apps/backend/sql/seed-issue-type-comcode.sql`

**Step 1: SQL seed 파일 작성 (Oracle 문법)**

```sql
-- 출고계정(Issue Account) ComCode seed 데이터
-- 기존 ISSUE_TYPE 값: PROD, SUBCON, SAMPLE, ADJ → 새 코드값으로 전환
-- COM_CODES 단일 테이블 (COM_CODE_GROUPS 없음)
-- 컬럼: USE_YN(Y/N), ATTR1(색상), SORT_ORDER, CODE_NAME

MERGE INTO "COM_CODES" t
USING (
  SELECT 'ISSUE_TYPE' AS "GROUP_CODE", 'PRODUCTION'   AS "DETAIL_CODE", '양산'     AS "CODE_NAME", 1  AS "SORT_ORDER", 'blue'    AS "ATTR1" FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'DEFECT',       '불량',       2,  'red'     FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'SAMPLE',       '샘플',       3,  'purple'  FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'DESIGN_START', '설계시작',   4,  'cyan'    FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'ADJUSTMENT',   '재고조정',   5,  'yellow'  FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'LOSS',         '로스',       6,  'orange'  FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'SUBCONTRACT',  '외주',       7,  'green'   FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'SCRAP',        '폐기',       8,  'red'     FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'RETURN',       '반품',       9,  'gray'    FROM DUAL UNION ALL
  SELECT 'ISSUE_TYPE', 'ETC',          '기타',       10, 'default' FROM DUAL
) s ON (t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "ID", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "CREATED_AT", "UPDATED_AT"
) VALUES (
  SYS_GUID(), s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", SYSDATE, SYSDATE
);
COMMIT;
```

**Step 2: oracle-db 스킬로 JSHANES 사이트에서 SQL 실행**

**Step 3: 커밋**

```bash
git add apps/backend/sql/seed-issue-type-comcode.sql
git commit -m "feat: 출고계정(ISSUE_TYPE) ComCode seed 데이터 추가"
```

---

### Task 2: 기존 데이터 마이그레이션

**Files:**
- Create: `apps/backend/sql/migrate-issue-type-values.sql`

**Step 1: 마이그레이션 SQL 작성 (Oracle 문법)**

```sql
-- 기존 ISSUE_TYPE 값을 새 코드값으로 변환
UPDATE "MAT_ISSUES" SET "ISSUE_TYPE" = 'PRODUCTION'  WHERE "ISSUE_TYPE" = 'PROD';
UPDATE "MAT_ISSUES" SET "ISSUE_TYPE" = 'ADJUSTMENT'  WHERE "ISSUE_TYPE" = 'ADJ';
UPDATE "MAT_ISSUES" SET "ISSUE_TYPE" = 'SUBCONTRACT' WHERE "ISSUE_TYPE" = 'SUBCON';
-- SAMPLE은 그대로 유지
COMMIT;
```

**Step 2: oracle-db 스킬로 JSHANES 사이트에서 SQL 실행**

**Step 3: 커밋**

```bash
git add apps/backend/sql/migrate-issue-type-values.sql
git commit -m "feat: 기존 ISSUE_TYPE 값 마이그레이션 SQL 추가"
```

---

### Task 3: shared 상수 정리

**Files:**
- Modify: `packages/shared/src/constants/com-code-values.ts:131-133`

**Step 1: ISSUE_TYPE_VALUES 주석 처리 및 deprecated 표시**

라인 131~133을 아래로 교체:

```typescript
// ===== 출고 유형 (ComCode ISSUE_TYPE 그룹으로 이관됨) =====
// @deprecated ComCode 'ISSUE_TYPE' 그룹 사용. 백엔드 DTO 검증에서 @IsIn 제거됨.
// export const ISSUE_TYPE_VALUES = ['PROD', 'SUBCON', 'SAMPLE', 'ADJ'] as const;
// export type IssueTypeValue = typeof ISSUE_TYPE_VALUES[number];
```

**Step 2: ISSUE_TYPE_VALUES를 import하는 곳 확인 및 제거**

영향받는 파일에서 import 제거:
- `apps/backend/src/modules/material/dto/mat-issue.dto.ts`

**Step 3: 커밋**

```bash
git add packages/shared/src/constants/com-code-values.ts
git commit -m "refactor: ISSUE_TYPE_VALUES 상수 deprecated 처리 (ComCode로 이관)"
```

---

### Task 4: 백엔드 엔티티 수정

**Files:**
- Modify: `apps/backend/src/entities/mat-issue.entity.ts:44-45`
- Modify: `apps/backend/src/entities/mat-issue-request.entity.ts` (issueType 컬럼 추가)

**Step 1: MatIssue 엔티티 기본값 제거**

라인 44를 아래로 교체:

```typescript
  @Column({ name: 'ISSUE_TYPE', length: 20 })
  issueType: string;
```

**Step 2: MatIssueRequest 엔티티에 issueType 컬럼 추가**

`remark` 컬럼 위에 추가:

```typescript
  @Column({ name: 'ISSUE_TYPE', length: 20, nullable: true })
  issueType: string | null;
```

**Step 3: 커밋**

```bash
git add apps/backend/src/entities/mat-issue.entity.ts apps/backend/src/entities/mat-issue-request.entity.ts
git commit -m "feat: MatIssue 기본값 제거, MatIssueRequest에 issueType 추가"
```

---

### Task 5: 백엔드 DTO 수정 (issueType 필수화)

**Files:**
- Modify: `apps/backend/src/modules/material/dto/mat-issue.dto.ts:43-47`
- Modify: `apps/backend/src/modules/material/dto/scan-issue.dto.ts:25-29`
- Modify: `apps/backend/src/modules/material/dto/issue-request.dto.ts` (CreateIssueRequestDto, RequestIssueDto에 issueType 추가)

**Step 1: CreateMatIssueDto에서 issueType 필수로 변경**

`mat-issue.dto.ts` 라인 43~47을 아래로 교체:

```typescript
  @ApiProperty({ description: '출고 유형 (ComCode ISSUE_TYPE)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  issueType: string;
```

파일 상단 import에 `IsNotEmpty`, `MaxLength` 추가.
`ISSUE_TYPE_VALUES` import와 `@IsIn` 제거.

**Step 2: MatIssueQueryDto의 issueType 필터 유지 (Optional)**

라인 92~96을 아래로 교체:

```typescript
  @ApiPropertyOptional({ description: '출고 유형 필터 (ComCode ISSUE_TYPE)' })
  @IsOptional()
  @IsString()
  issueType?: string;
```

`@IsIn` 제거.

**Step 3: ScanIssueDto에서 issueType 필수로 변경**

`scan-issue.dto.ts` 라인 25~29를 아래로 교체:

```typescript
  @ApiProperty({ description: '출고 유형 (ComCode ISSUE_TYPE)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  issueType: string;
```

파일 상단 import에 `IsNotEmpty` 추가. `@IsOptional` import 남겨둠 (다른 필드에서 사용).

**Step 4: CreateIssueRequestDto에 issueType 추가**

`issue-request.dto.ts`의 `CreateIssueRequestDto` 클래스에 `jobOrderId` 필드 뒤에 추가:

```typescript
  @ApiPropertyOptional({ description: '출고 유형 (ComCode ISSUE_TYPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  issueType?: string;
```

**Step 5: RequestIssueDto에 issueType 추가**

`issue-request.dto.ts`의 `RequestIssueDto` 클래스에 `warehouseCode` 필드 뒤에 추가:

```typescript
  @ApiPropertyOptional({ description: '출고 유형 (ComCode ISSUE_TYPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  issueType?: string;
```

**Step 6: 커밋**

```bash
git add apps/backend/src/modules/material/dto/mat-issue.dto.ts apps/backend/src/modules/material/dto/scan-issue.dto.ts apps/backend/src/modules/material/dto/issue-request.dto.ts
git commit -m "feat: issueType을 모든 출고 DTO에서 필수/지원으로 변경"
```

---

### Task 6: 백엔드 서비스 수정

**Files:**
- Modify: `apps/backend/src/modules/material/services/mat-issue.service.ts:151, 237`
- Modify: `apps/backend/src/modules/material/services/issue-request.service.ts:50, 192-195`

**Step 1: MatIssueService.create()에서 fallback 제거**

`mat-issue.service.ts` 라인 151을 아래로 교체:

```typescript
          issueType,
```

(기존: `issueType: issueType ?? 'PROD'`)

**Step 2: MatIssueService.scanIssue()에서 fallback 제거**

라인 237을 아래로 교체:

```typescript
      issueType: dto.issueType,
```

(기존: `issueType: dto.issueType ?? 'PROD'`)

**Step 3: IssueRequestService.create()에서 issueType 저장**

`issue-request.service.ts`에서 요청 생성 시 issueType을 저장하도록 수정.
request 객체 생성 부분에 `issueType: dto.issueType ?? null` 추가.

**Step 4: IssueRequestService.issueFromRequest()에서 요청의 issueType 전달**

라인 195의 `issueType: 'PROD'`를 아래로 교체:

```typescript
        issueType: dto.issueType ?? request.issueType ?? 'PRODUCTION',
```

**Step 5: 커밋**

```bash
git add apps/backend/src/modules/material/services/mat-issue.service.ts apps/backend/src/modules/material/services/issue-request.service.ts
git commit -m "feat: 서비스에서 issueType fallback 제거, 출고요청 issueType 전달"
```

---

### Task 7: i18n 다국어 파일 업데이트 (ko, en, zh, vi)

**Files:**
- Modify: `apps/frontend/src/locales/ko.json` (ISSUE_TYPE 섹션)
- Modify: `apps/frontend/src/locales/en.json` (ISSUE_TYPE 섹션)
- Modify: `apps/frontend/src/locales/zh.json` (ISSUE_TYPE 섹션)
- Modify: `apps/frontend/src/locales/vi.json` (ISSUE_TYPE 섹션)

**Step 1: ko.json — ISSUE_TYPE 값 확장**

기존:
```json
"ISSUE_TYPE": { "PROD": "생산", "SUBCON": "외주", "SAMPLE": "샘플", "ADJ": "조정" }
```

변경:
```json
"ISSUE_TYPE": { "PRODUCTION": "양산", "DEFECT": "불량", "SAMPLE": "샘플", "DESIGN_START": "설계시작", "ADJUSTMENT": "재고조정", "LOSS": "로스", "SUBCONTRACT": "외주", "SCRAP": "폐기", "RETURN": "반품", "ETC": "기타" }
```

또한 `material.issue` 관련 키에 `issueAccount` 라벨 추가:

```json
"material.issueAccount": "출고계정"
```

**Step 2: en.json — ISSUE_TYPE 값 확장**

```json
"ISSUE_TYPE": { "PRODUCTION": "Production", "DEFECT": "Defect", "SAMPLE": "Sample", "DESIGN_START": "Design Start", "ADJUSTMENT": "Adjustment", "LOSS": "Loss", "SUBCONTRACT": "Subcontract", "SCRAP": "Scrap", "RETURN": "Return", "ETC": "Etc" }
```

```json
"material.issueAccount": "Issue Account"
```

**Step 3: zh.json — ISSUE_TYPE 값 확장**

```json
"ISSUE_TYPE": { "PRODUCTION": "量产", "DEFECT": "不良", "SAMPLE": "样品", "DESIGN_START": "设计开始", "ADJUSTMENT": "库存调整", "LOSS": "损耗", "SUBCONTRACT": "外包", "SCRAP": "报废", "RETURN": "退货", "ETC": "其他" }
```

```json
"material.issueAccount": "出库账户"
```

**Step 4: vi.json — ISSUE_TYPE 값 확장**

```json
"ISSUE_TYPE": { "PRODUCTION": "Sản xuất", "DEFECT": "Lỗi", "SAMPLE": "Mẫu", "DESIGN_START": "Bắt đầu thiết kế", "ADJUSTMENT": "Điều chỉnh tồn kho", "LOSS": "Hao hụt", "SUBCONTRACT": "Gia công ngoài", "SCRAP": "Phế liệu", "RETURN": "Trả hàng", "ETC": "Khác" }
```

```json
"material.issueAccount": "Tài khoản xuất kho"
```

**Step 5: Grep으로 4개 파일에 모든 키 존재 확인**

**Step 6: 커밋**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "feat: ISSUE_TYPE 출고계정 i18n 다국어 확장 (10개 코드값)"
```

---

### Task 8: 프론트엔드 — useManualIssue 훅에 issueType 추가

**Files:**
- Modify: `apps/frontend/src/hooks/material/useManualIssue.ts:120-130`

**Step 1: issueType state 추가**

훅 함수 내부 상단에 state 추가:

```typescript
const [issueType, setIssueType] = useState<string>('PRODUCTION');
```

**Step 2: handleIssue에 issueType 전달**

라인 125의 API 호출을 아래로 변경:

```typescript
await api.post('/material/issues', { items, issueType });
```

**Step 3: return 객체에 issueType, setIssueType 추가**

```typescript
return {
  ...기존값,
  issueType,
  setIssueType,
};
```

**Step 4: 커밋**

```bash
git add apps/frontend/src/hooks/material/useManualIssue.ts
git commit -m "feat: useManualIssue에 issueType state 및 API 전달 추가"
```

---

### Task 9: 프론트엔드 — useBarcodeScan 훅에 issueType 추가

**Files:**
- Modify: `apps/frontend/src/hooks/material/useBarcodeScan.ts:73-101`

**Step 1: issueType state 추가**

```typescript
const [issueType, setIssueType] = useState<string>('PRODUCTION');
```

**Step 2: handleIssue에 issueType 전달**

라인 78의 API 호출을 아래로 변경:

```typescript
const res = await api.post('/material/issues/scan', { lotNo: scannedLot.lotNo, issueType });
```

**Step 3: return 객체에 issueType, setIssueType 추가**

**Step 4: 커밋**

```bash
git add apps/frontend/src/hooks/material/useBarcodeScan.ts
git commit -m "feat: useBarcodeScan에 issueType state 및 API 전달 추가"
```

---

### Task 10: 프론트엔드 — ManualIssueTab에 출고계정 드롭다운 추가

**Files:**
- Modify: `apps/frontend/src/components/material/ManualIssueTab.tsx`

**Step 1: import 추가**

```typescript
import { useComCodeOptions } from '@/hooks/useComCode';
```

**Step 2: 훅 호출**

컴포넌트 내부에서:

```typescript
const issueTypeOptions = useComCodeOptions('ISSUE_TYPE');
```

**Step 3: 출고계정 Select 드롭다운 추가**

창고 필터 옆에 출고계정 드롭다운 추가:

```tsx
<Select
  label={t('material.issueAccount')}
  options={issueTypeOptions}
  value={issueType}
  onChange={setIssueType}
  required
/>
```

**Step 4: 출고 버튼에 issueType 미선택 시 비활성화 조건 추가**

```tsx
disabled={selectedItems.size === 0 || !issueType}
```

**Step 5: 커밋**

```bash
git add apps/frontend/src/components/material/ManualIssueTab.tsx
git commit -m "feat: ManualIssueTab에 출고계정 드롭다운 추가"
```

---

### Task 11: 프론트엔드 — BarcodeScanTab에 출고계정 드롭다운 추가

**Files:**
- Modify: `apps/frontend/src/components/material/BarcodeScanTab.tsx`

**Step 1: import 추가**

```typescript
import { useComCodeOptions } from '@/hooks/useComCode';
```

**Step 2: 훅 호출**

```typescript
const issueTypeOptions = useComCodeOptions('ISSUE_TYPE');
```

**Step 3: 스캔 입력 필드 위에 출고계정 드롭다운 추가**

```tsx
<Select
  label={t('material.issueAccount')}
  options={issueTypeOptions}
  value={issueType}
  onChange={setIssueType}
  required
/>
```

연속 스캔 시 선택값 유지 (state가 리셋되지 않음).

**Step 4: 전량출고 버튼에 issueType 미선택 시 비활성화 추가**

**Step 5: 커밋**

```bash
git add apps/frontend/src/components/material/BarcodeScanTab.tsx
git commit -m "feat: BarcodeScanTab에 출고계정 드롭다운 추가"
```

---

### Task 12: 프론트엔드 — IssueRequestTab / IssueFromRequestModal에 출고계정 반영

**Files:**
- Modify: `apps/frontend/src/components/material/IssueRequestTab.tsx`
- Modify: `apps/frontend/src/components/material/IssueFromRequestModal.tsx`

**Step 1: IssueRequestTab — DataGrid에 출고계정 컬럼 추가**

ComCodeBadge로 표시:

```tsx
{
  field: 'issueType',
  headerName: t('material.issueAccount'),
  renderCell: (params) => params.value ? <ComCodeBadge groupCode="ISSUE_TYPE" code={params.value} /> : '-',
}
```

**Step 2: IssueFromRequestModal — 출고계정 드롭다운 추가**

모달 상단에 출고계정 선택 드롭다운 추가. 요청에 issueType이 있으면 기본값으로 설정.

```tsx
const [issueType, setIssueType] = useState(request?.issueType || 'PRODUCTION');
```

출고 처리 API 호출 시 issueType 전달.

**Step 3: 커밋**

```bash
git add apps/frontend/src/components/material/IssueRequestTab.tsx apps/frontend/src/components/material/IssueFromRequestModal.tsx
git commit -m "feat: IssueRequestTab/Modal에 출고계정 표시 및 선택 추가"
```

---

### Task 13: 프론트엔드 — IssueHistoryTab에 출고계정 ComCodeBadge 적용

**Files:**
- Modify: `apps/frontend/src/components/material/IssueHistoryTab.tsx`

**Step 1: import 추가**

```typescript
import ComCodeBadge from '@/components/ui/ComCodeBadge';
import { useComCodeOptions } from '@/hooks/useComCode';
```

**Step 2: DataGrid의 issueType 컬럼을 ComCodeBadge로 렌더링**

기존 issueType 텍스트 표시 → ComCodeBadge로 교체:

```tsx
{
  field: 'issueType',
  headerName: t('material.issueAccount'),
  renderCell: (params) => <ComCodeBadge groupCode="ISSUE_TYPE" code={params.value} />,
}
```

**Step 3: 필터에 출고계정 드롭다운 추가**

상태 필터 옆에 출고계정 필터 추가:

```tsx
const issueTypeOptions = useComCodeOptions('ISSUE_TYPE');
```

```tsx
<Select
  label={t('material.issueAccount')}
  options={[{ value: '', label: t('common.all') }, ...issueTypeOptions]}
  value={issueTypeFilter}
  onChange={setIssueTypeFilter}
/>
```

**Step 4: 커밋**

```bash
git add apps/frontend/src/components/material/IssueHistoryTab.tsx
git commit -m "feat: IssueHistoryTab에 ComCodeBadge 적용 및 출고계정 필터 추가"
```

---

### Task 14: 최종 검증 및 정리

**Step 1: Grep으로 잔여 하드코딩 확인**

`ISSUE_TYPE_VALUES`를 사용하는 곳이 남아있는지 검색.
`'PROD'` 리터럴이 issueType 관련으로 남아있는지 검색.

**Step 2: i18n 검증**

4개 언어 파일에서 `ISSUE_TYPE` 그룹의 모든 코드값이 존재하는지 확인.
`material.issueAccount` 키가 4개 파일에 모두 존재하는지 확인.

**Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: 출고계정(Issue Account) 시스템 완성 — ComCode 기반 동적 관리"
```
