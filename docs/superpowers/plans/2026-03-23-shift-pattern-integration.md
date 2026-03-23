# 교대패턴 시스템 연동 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교대패턴(SHIFT_PATTERNS)을 생산실적·CAPA 계산·모니터링에 연동하여, 교대 자동판별과 교대별 분석을 가능하게 한다.

**Architecture:** ProdResult에 SHIFT_CODE 컬럼을 추가하고, ShiftResolver 유틸로 startAt 기반 교대를 자동판별한다. AutoPlanService의 CAPA 계산을 교대별 가용시간 기반으로 개선하고, 진행현황 API/UI에 교대 필터를 추가한다.

**Tech Stack:** NestJS, TypeORM, Oracle DB, Next.js, React

**Spec:** `docs/superpowers/specs/2026-03-23-shift-pattern-integration-design.md`

---

## Task 1: ProdResult 엔티티에 SHIFT_CODE 컬럼 추가

**Files:**
- Modify: `apps/backend/src/entities/prod-result.entity.ts`
- DDL: `scripts/migration/alter_prod_results_add_shift_code.sql`

- [ ] **Step 1: DDL 파일 작성**

```sql
ALTER TABLE PROD_RESULTS ADD SHIFT_CODE VARCHAR2(20)
```

저장: `scripts/migration/alter_prod_results_add_shift_code.sql`

- [ ] **Step 2: Oracle DB에 DDL 실행**

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --execute-file scripts/migration/alter_prod_results_add_shift_code.sql
```

Expected: `"success": true`

- [ ] **Step 3: 엔티티에 SHIFT_CODE 컬럼 추가**

`apps/backend/src/entities/prod-result.entity.ts`의 `@Index(['status'])` 아래에 추가:

```typescript
@Index(['shiftCode'])
```

`remark` 컬럼 아래에 추가:

```typescript
@Column({ name: 'SHIFT_CODE', length: 20, nullable: true })
shiftCode: string | null;
```

- [ ] **Step 4: 인덱스 생성**

```bash
python C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py --site JSHANES --query "CREATE INDEX IDX_PROD_RESULTS_SHIFT ON PROD_RESULTS (SHIFT_CODE)"
```

- [ ] **Step 5: 빌드 확인**

```bash
pnpm build
```

Expected: 에러 0건

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/src/entities/prod-result.entity.ts scripts/migration/alter_prod_results_add_shift_code.sql
git commit -m "feat(entity): add SHIFT_CODE column to ProdResult"
```

---

## Task 2: ShiftResolver 유틸 생성

**Files:**
- Create: `apps/backend/src/utils/shift-resolver.ts`

- [ ] **Step 1: ShiftResolver 유틸 파일 생성**

`apps/backend/src/utils/shift-resolver.ts`:

```typescript
/**
 * @file utils/shift-resolver.ts
 * @description 교대 자동판별 유틸 — startAt 시각을 교대패턴 시간대와 비교하여 교대코드를 반환한다.
 *
 * 초보자 가이드:
 * 1. resolve(): timestamp와 company/plant를 받아 교대코드 반환
 * 2. 자정 넘김(야간 교대): START_TIME > END_TIME이면 두 구간 분리 비교
 * 3. 매칭 실패 시 null 반환 (강제하지 않음)
 */
import { Repository } from 'typeorm';
import { ShiftPattern } from '../entities/shift-pattern.entity';

export class ShiftResolver {
  constructor(private readonly shiftRepo: Repository<ShiftPattern>) {}

  /**
   * startAt 시각 기반으로 교대코드를 자동판별한다.
   * @param startAt 생산실적 시작 시각
   * @param company 회사 코드
   * @param plant 공장 코드
   * @returns shiftCode 또는 null
   */
  async resolve(
    startAt: Date,
    company: string,
    plant: string,
  ): Promise<string | null> {
    const patterns = await this.shiftRepo.find({
      where: { company, plant, useYn: 'Y' },
      order: { sortOrder: 'ASC' },
    });

    if (patterns.length === 0) return null;

    const hhmm = this.toHHMM(startAt);

    for (const p of patterns) {
      if (this.isInRange(hhmm, p.startTime, p.endTime)) {
        return p.shiftCode;
      }
    }

    return null;
  }

  /** Date → "HH:MM" 문자열 변환 */
  private toHHMM(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  /** 시각이 교대 시간 범위에 포함되는지 확인 (자정 넘김 지원) */
  private isInRange(hhmm: string, start: string, end: string): boolean {
    if (start <= end) {
      // 일반 범위: 08:00~17:00
      return hhmm >= start && hhmm < end;
    }
    // 자정 넘김: 20:00~05:00 → (20:00~23:59) OR (00:00~05:00)
    return hhmm >= start || hhmm < end;
  }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build
```

Expected: 에러 0건

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/utils/shift-resolver.ts
git commit -m "feat(utils): add ShiftResolver for auto shift detection"
```

---

## Task 3: ProdResultService에 교대 자동판별 연동

**Files:**
- Modify: `apps/backend/src/modules/production/services/prod-result.service.ts`
- Modify: `apps/backend/src/modules/production/dto/prod-result.dto.ts`
- Modify: `apps/backend/src/modules/production/production.module.ts`

- [ ] **Step 1: DTO에 shiftCode 필드 추가**

`apps/backend/src/modules/production/dto/prod-result.dto.ts`의 `CreateProdResultDto`에 추가:

```typescript
@ApiPropertyOptional({ description: '교대 코드 (미지정 시 자동판별)', maxLength: 20 })
@IsOptional() @IsString() @MaxLength(20)
shiftCode?: string;
```

`ProdResultQueryDto`에 추가:

```typescript
@ApiPropertyOptional({ description: '교대 코드 필터' })
@IsOptional() @IsString()
shiftCode?: string;
```

- [ ] **Step 2: production.module.ts에 ShiftPattern 엔티티 등록**

`imports`의 `TypeOrmModule.forFeature([...])` 배열에 `ShiftPattern` 추가.

```typescript
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
// TypeOrmModule.forFeature([..., ShiftPattern])
```

- [ ] **Step 3: ProdResultService에 ShiftResolver 통합**

constructor에 ShiftPattern Repository 주입:

```typescript
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { ShiftResolver } from '../../../utils/shift-resolver';

// constructor에 추가:
@InjectRepository(ShiftPattern)
private readonly shiftPatternRepo: Repository<ShiftPattern>,
```

private 필드 추가:

```typescript
private shiftResolver: ShiftResolver;
```

constructor 본문 마지막에:

```typescript
this.shiftResolver = new ShiftResolver(this.shiftPatternRepo);
```

- [ ] **Step 4: create 메서드에 교대 자동판별 추가**

create 메서드에서 `await this.prodResultRepository.save(entity)` 직전에 추가:

```typescript
// 교대 자동판별
if (dto.shiftCode) {
  entity.shiftCode = dto.shiftCode;
} else if (entity.startAt && entity.company && entity.plant) {
  entity.shiftCode = await this.shiftResolver.resolve(
    new Date(entity.startAt), entity.company, entity.plant,
  );
}
```

- [ ] **Step 5: findAll 쿼리에 shiftCode 필터 추가**

findAll 메서드의 where 조건 구성부에 추가:

```typescript
if (query.shiftCode) {
  where['shiftCode'] = query.shiftCode;
}
```

- [ ] **Step 6: 빌드 확인**

```bash
pnpm build
```

Expected: 에러 0건

- [ ] **Step 7: 커밋**

```bash
git add apps/backend/src/modules/production/services/prod-result.service.ts apps/backend/src/modules/production/dto/prod-result.dto.ts apps/backend/src/modules/production/production.module.ts
git commit -m "feat(prod-result): integrate ShiftResolver for auto shift detection"
```

---

## Task 4: AutoPlanService CAPA 계산에 교대별 가용시간 반영

**Files:**
- Modify: `apps/backend/src/modules/production/services/auto-plan.service.ts`

- [ ] **Step 1: countWorkDays를 getMonthlyAvailableMinutes로 확장**

기존 `countWorkDays` 메서드를 유지하면서 새 메서드 추가:

```typescript
/**
 * 월간 가용 근무시간(분)을 교대패턴 기반으로 계산한다.
 * 각 WORK 일의 shifts(CSV)를 파싱 → 교대별 workMinutes 합산
 */
async getMonthlyAvailableMinutes(
  calendarId: string,
  month: string,
  company: string,
  plant: string,
): Promise<number> {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const lastDay = new Date(year, mon, 0).getDate();
  const startDate = `${month}-01`;
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const days = await this.calendarDayRepo.find({
    where: {
      calendarId,
      dayType: 'WORK',
      workDate: Between(startDate, endDate) as any,
    },
  });

  // 교대패턴 조회
  const shifts = await this.shiftRepo.find({
    where: { company, plant, useYn: 'Y' },
  });
  const shiftMap = new Map(shifts.map((s) => [s.shiftCode, s.workMinutes]));

  let totalMinutes = 0;
  for (const day of days) {
    if (day.shifts) {
      const codes = day.shifts.split(',').map((c) => c.trim());
      for (const code of codes) {
        totalMinutes += shiftMap.get(code) ?? 0;
      }
    } else {
      // shifts CSV가 없으면 workMinutes 직접 사용
      totalMinutes += day.workMinutes ?? 0;
    }
  }

  return totalMinutes;
}
```

- [ ] **Step 2: ShiftPattern Repository 주입 확인**

constructor에 이미 `shiftRepo`가 있는지 확인. 없으면 추가:

```typescript
import { ShiftPattern } from '../../../entities/shift-pattern.entity';

@InjectRepository(ShiftPattern)
private readonly shiftRepo: Repository<ShiftPattern>,
```

production.module.ts의 TypeOrmModule.forFeature에 `ShiftPattern`이 이미 Task 3에서 추가됨.

- [ ] **Step 3: preview 메서드에서 가용시간 활용**

preview 메서드에서 `countWorkDays` 호출 근처에 `getMonthlyAvailableMinutes` 호출 추가. monthlyCapa 계산 시 workDays 대신 가용시간 사용 가능하도록 결과에 포함:

```typescript
const availableMinutes = await this.getMonthlyAvailableMinutes(
  calendarId, month, company, plant,
);
```

기존 `workDays * dailyCapa` 계산은 유지하되, 응답에 `availableMinutes` 필드를 추가하여 프론트엔드에서 표시 가능하게 함.

- [ ] **Step 4: 빌드 확인**

```bash
pnpm build
```

Expected: 에러 0건

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/production/services/auto-plan.service.ts
git commit -m "feat(auto-plan): add shift-based monthly available minutes for CAPA"
```

---

## Task 5: 모니터링 진행현황 API에 교대 필터 추가

**Files:**
- Modify: `apps/backend/src/modules/production/controllers/production-views.controller.ts`
- Modify: `apps/backend/src/modules/production/services/production-views.service.ts` (또는 해당 서비스 파일)

- [ ] **Step 1: ProgressQueryDto에 shift 파라미터 추가**

`production-views.controller.ts` 또는 해당 DTO 파일에서 `ProgressQueryDto`에 추가:

```typescript
@ApiPropertyOptional({ description: '교대 코드 필터' })
@IsOptional() @IsString()
shift?: string;
```

- [ ] **Step 2: getProgress 서비스 쿼리에 shift 필터 추가**

서비스의 `getProgress` 메서드에서 QueryBuilder 사용 시:

```typescript
if (query.shift) {
  qb.andWhere('pr.SHIFT_CODE = :shift', { shift: query.shift });
}
```

또는 Repository.find 방식이면 where 조건에 추가.

핵심: JobOrder에 leftJoin된 ProdResult의 SHIFT_CODE로 필터링하여, 해당 교대의 실적만 포함된 진행현황을 반환.

- [ ] **Step 3: 빌드 확인**

```bash
pnpm build
```

Expected: 에러 0건

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/production/controllers/production-views.controller.ts apps/backend/src/modules/production/services/production-views.service.ts
git commit -m "feat(views): add shift filter to production progress API"
```

---

## Task 6: 프론트엔드 진행현황 페이지에 교대 드롭다운 필터 추가

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/progress/page.tsx`

- [ ] **Step 1: SHIFT_PATTERNS API에서 교대 옵션 조회**

```typescript
const [shiftOptions, setShiftOptions] = useState<Array<{ value: string; label: string }>>([]);
const [shiftFilter, setShiftFilter] = useState('');

useEffect(() => {
  api.get('/master/shift-patterns').then((res) => {
    const patterns = res.data?.data ?? [];
    setShiftOptions(patterns.map((p: any) => ({
      value: p.shiftCode,
      label: `${p.shiftName} (${p.startTime}~${p.endTime})`,
    })));
  });
}, []);
```

- [ ] **Step 2: 필터 영역에 교대 드롭다운 추가**

기존 필터 영역(상태 필터, 날짜 필터 근처)에 Select 컴포넌트 추가:

```tsx
<Select
  options={[{ value: '', label: t('common.all') }, ...shiftOptions]}
  value={shiftFilter}
  onChange={(e) => setShiftFilter(e.target.value)}
  fullWidth
/>
```

- [ ] **Step 3: API 호출 시 shift 파라미터 전달**

데이터 조회 함수에서 shift 파라미터 추가:

```typescript
const params: any = { ...existingParams };
if (shiftFilter) params.shift = shiftFilter;
```

- [ ] **Step 4: i18n 키 추가 (4개 파일)**

`ko.json`: `"shiftFilter": "교대"`
`en.json`: `"shiftFilter": "Shift"`
`zh.json`: `"shiftFilter": "班次"`
`vi.json`: `"shiftFilter": "Ca làm việc"`

- [ ] **Step 5: 빌드 확인**

```bash
pnpm build
```

Expected: 에러 0건

- [ ] **Step 6: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/production/progress/page.tsx apps/frontend/src/locales/*.json
git commit -m "feat(frontend): add shift filter to production progress page"
```

---

## 구현 순서 요약

| Task | 내용 | 의존성 |
|------|------|--------|
| 1 | ProdResult SHIFT_CODE 컬럼 추가 | 없음 |
| 2 | ShiftResolver 유틸 생성 | 없음 |
| 3 | ProdResultService 교대 자동판별 연동 | Task 1, 2 |
| 4 | AutoPlanService CAPA 교대 연동 | 없음 |
| 5 | 모니터링 API 교대 필터 | Task 1 |
| 6 | 프론트엔드 교대 필터 UI | Task 5 |

Task 1+2는 병렬 가능, Task 4도 독립 실행 가능.
