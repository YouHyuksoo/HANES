# 생산월력관리 (Work Calendar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MES 기준정보에 생산월력관리 기능 추가 — 교대 패턴 마스터 + 월력 헤더(공장/공정별) + 일자별 상세(근무/비가동/잔업)를 관리하는 화면과 API

**Architecture:** 3개 엔티티(ShiftPattern, WorkCalendar, WorkCalendarDay) + 1개 서비스/컨트롤러 + 프론트엔드 달력 UI. 기존 master 모듈에 통합. 공장 기본 월력 + 공정별 독립 월력, 연간 일괄 생성 + 월별 상세 편집 지원.

**Tech Stack:** NestJS, TypeORM, Oracle DB, Next.js, React, i18n (ko/en/zh/vi), ComCode

**Spec:** `docs/superpowers/specs/2026-03-22-work-calendar-design.md`

---

## File Structure

### Backend — Entities
- Create: `apps/backend/src/entities/shift-pattern.entity.ts` — 교대 패턴 마스터
- Create: `apps/backend/src/entities/work-calendar.entity.ts` — 월력 헤더
- Create: `apps/backend/src/entities/work-calendar-day.entity.ts` — 일자별 상세

### Backend — Module
- Create: `apps/backend/src/modules/master/dto/work-calendar.dto.ts` — DTO 전체
- Create: `apps/backend/src/modules/master/services/work-calendar.service.ts` — 월력 비즈니스 로직
- Create: `apps/backend/src/modules/master/services/shift-pattern.service.ts` — 교대 패턴 비즈니스 로직
- Create: `apps/backend/src/modules/master/controllers/work-calendar.controller.ts` — 월력 API
- Create: `apps/backend/src/modules/master/controllers/shift-pattern.controller.ts` — 교대 패턴 API
- Modify: `apps/backend/src/modules/master/master.module.ts` — 엔티티/컨트롤러/서비스 등록

### Backend — Seed
- Modify: `apps/backend/src/seeds/menu-config.json` — MST_WORK_CALENDAR 코드 추가

### Frontend
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/page.tsx` — 메인 페이지
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/components/CalendarGrid.tsx` — 달력 그리드
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/components/CalendarFormPanel.tsx` — 헤더 폼
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/components/ShiftPatternTab.tsx` — 교대 패턴 탭
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/components/DayEditModal.tsx` — 일자 편집 모달
- Modify: `apps/frontend/src/config/menuConfig.ts` — 메뉴 등록
- Modify: `apps/frontend/src/locales/ko.json` — 한국어
- Modify: `apps/frontend/src/locales/en.json` — 영어
- Modify: `apps/frontend/src/locales/zh.json` — 중국어
- Modify: `apps/frontend/src/locales/vi.json` — 베트남어

---

### Task 1: 교대 패턴 엔티티 (ShiftPattern)

**Files:**
- Create: `apps/backend/src/entities/shift-pattern.entity.ts`

- [ ] **Step 1: 엔티티 파일 생성**

```typescript
/**
 * @file entities/shift-pattern.entity.ts
 * @description 교대 패턴 마스터 엔티티 — 주간/야간/3교대 등 교대 근무 패턴 정보 관리.
 *              복합 PK: (COMPANY, PLANT_CD, SHIFT_CODE)
 *
 * 초보자 가이드:
 * 1. company + plant + shiftCode가 복합 PK
 * 2. startTime/endTime: HH:MM 형식 (예: 08:00, 17:00)
 * 3. workMinutes = 총시간 - breakMinutes
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'SHIFT_PATTERNS' })
@Index(['useYn'])
export class ShiftPattern {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'SHIFT_CODE', length: 20 })
  shiftCode: string;

  @Column({ name: 'SHIFT_NAME', length: 100 })
  shiftName: string;

  @Column({ name: 'START_TIME', length: 5 })
  startTime: string;

  @Column({ name: 'END_TIME', length: 5 })
  endTime: string;

  @Column({ name: 'BREAK_MINUTES', type: 'int', default: 60 })
  breakMinutes: number;

  @Column({ name: 'WORK_MINUTES', type: 'int', default: 0 })
  workMinutes: number;

  @Column({ name: 'SORT_ORDER', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd apps/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: 해당 파일 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/entities/shift-pattern.entity.ts
git commit -m "feat(entity): add ShiftPattern entity for shift schedule master"
```

---

### Task 2: 월력 헤더 엔티티 (WorkCalendar)

**Files:**
- Create: `apps/backend/src/entities/work-calendar.entity.ts`

- [ ] **Step 1: 엔티티 파일 생성**

```typescript
/**
 * @file entities/work-calendar.entity.ts
 * @description 월력 헤더 엔티티 — 연도별 공장/공정 작업 캘린더 관리.
 *              PK: CALENDAR_ID (자연키, 예: WC-2026-PLANT01-CRIMP)
 *
 * 초보자 가이드:
 * 1. calendarId가 PK (자연키)
 * 2. processCd가 NULL이면 공장 기본 월력, 값이 있으면 공정별 월력
 * 3. status: DRAFT → CONFIRMED 워크플로우
 * 4. defaultShifts: CSV 형식 (예: "DAY,NIGHT")
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index, Unique,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ProcessMaster } from './process-master.entity';

@Entity({ name: 'WORK_CALENDARS' })
@Index(['company', 'plant', 'calendarYear'])
@Index(['processCd'])
@Unique('UQ_WORK_CAL_YEAR_PROC', ['company', 'plant', 'calendarYear', 'processCd'])
export class WorkCalendar {
  @PrimaryColumn({ name: 'CALENDAR_ID', length: 50 })
  calendarId: string;

  @Column({ name: 'CALENDAR_YEAR', length: 4 })
  calendarYear: string;

  @Column({ name: 'PROCESS_CD', length: 50, nullable: true })
  processCd: string | null;

  @ManyToOne(() => ProcessMaster, { nullable: true })
  @JoinColumn({ name: 'PROCESS_CD', referencedColumnName: 'processCode' })
  process: ProcessMaster | null;

  @Column({ name: 'DEFAULT_SHIFT_COUNT', type: 'int', default: 1 })
  defaultShiftCount: number;

  @Column({ name: 'DEFAULT_SHIFTS', length: 100, nullable: true })
  defaultShifts: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/entities/work-calendar.entity.ts
git commit -m "feat(entity): add WorkCalendar header entity"
```

---

### Task 3: 일자별 상세 엔티티 (WorkCalendarDay)

**Files:**
- Create: `apps/backend/src/entities/work-calendar-day.entity.ts`

- [ ] **Step 1: 엔티티 파일 생성**

```typescript
/**
 * @file entities/work-calendar-day.entity.ts
 * @description 월력 일자별 상세 엔티티 — 날짜별 근무유형, 교대, 가용시간 관리.
 *              복합 PK: (CALENDAR_ID, WORK_DATE)
 *
 * 초보자 가이드:
 * 1. calendarId + workDate가 복합 PK
 * 2. dayType: 공통코드 WORK_DAY_TYPE (WORK/OFF/HALF/SPECIAL)
 * 3. offReason: 공통코드 DAY_OFF_TYPE (HOLIDAY/REGULAR/MAINTENANCE 등)
 * 4. workMinutes: 자동계산 — 교대 패턴의 workMinutes 합계
 * 5. otMinutes: 잔업시간(분)
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'WORK_CALENDAR_DAYS' })
@Index(['workDate', 'dayType'])
export class WorkCalendarDay {
  @PrimaryColumn({ name: 'CALENDAR_ID', length: 50 })
  calendarId: string;

  @PrimaryColumn({ name: 'WORK_DATE', type: 'date' })
  workDate: string;

  @Column({ name: 'DAY_TYPE', length: 20, default: 'WORK' })
  dayType: string;

  @Column({ name: 'OFF_REASON', length: 20, nullable: true })
  offReason: string | null;

  @Column({ name: 'SHIFT_COUNT', type: 'int', default: 1 })
  shiftCount: number;

  @Column({ name: 'SHIFTS', length: 100, nullable: true })
  shifts: string | null;

  @Column({ name: 'WORK_MINUTES', type: 'int', default: 0 })
  workMinutes: number;

  @Column({ name: 'OT_MINUTES', type: 'int', default: 0 })
  otMinutes: number;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/entities/work-calendar-day.entity.ts
git commit -m "feat(entity): add WorkCalendarDay detail entity"
```

---

### Task 4: DTO 작성

**Files:**
- Create: `apps/backend/src/modules/master/dto/work-calendar.dto.ts`

- [ ] **Step 1: DTO 파일 생성**

```typescript
/**
 * @file src/modules/master/dto/work-calendar.dto.ts
 * @description 생산월력관리 DTO — 교대패턴, 월력헤더, 일자상세 CRUD용
 *
 * 초보자 가이드:
 * 1. ShiftPattern DTO: 교대 패턴 CRUD
 * 2. WorkCalendar DTO: 월력 헤더 CRUD + 연간 생성/복사
 * 3. WorkCalendarDay DTO: 일자 일괄 수정
 * 4. WorkCalendarQuery: 목록 조회 필터
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, IsArray, ValidateNested,
  IsIn, MaxLength, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── 교대 패턴 DTO ───

export class CreateShiftPatternDto {
  @ApiProperty({ example: 'DAY' })
  @IsString() @MaxLength(20)
  shiftCode: string;

  @ApiProperty({ example: '주간' })
  @IsString() @MaxLength(100)
  shiftName: string;

  @ApiProperty({ example: '08:00' })
  @IsString() @MaxLength(5)
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString() @MaxLength(5)
  endTime: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional() @Type(() => Number) @IsInt()
  breakMinutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt()
  workMinutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt()
  sortOrder?: number;
}

export class UpdateShiftPatternDto extends PartialType(CreateShiftPatternDto) {}

// ─── 월력 헤더 DTO ───

export class CreateWorkCalendarDto {
  @ApiProperty({ example: 'WC-2026-PLANT01' })
  @IsString() @MaxLength(50)
  calendarId: string;

  @ApiProperty({ example: '2026' })
  @IsString() @MaxLength(4)
  calendarYear: string;

  @ApiPropertyOptional({ description: '공정코드 (NULL=공장기본)' })
  @IsOptional() @IsString() @MaxLength(50)
  processCd?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3)
  defaultShiftCount?: number;

  @ApiPropertyOptional({ example: 'DAY,NIGHT' })
  @IsOptional() @IsString() @MaxLength(100)
  defaultShifts?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string;
}

export class UpdateWorkCalendarDto extends PartialType(CreateWorkCalendarDto) {}

export class WorkCalendarQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional() @Type(() => Number) @IsInt()
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  calendarYear?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  processCd?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  search?: string;
}

// ─── 일자 상세 DTO ───

export class WorkCalendarDayItemDto {
  @ApiProperty({ example: '2026-03-22' })
  @IsString()
  workDate: string;

  @ApiProperty({ example: 'WORK' })
  @IsString() @IsIn(['WORK', 'OFF', 'HALF', 'SPECIAL'])
  dayType: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(20)
  offReason?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt()
  shiftCount?: number;

  @ApiPropertyOptional({ example: 'DAY,NIGHT' })
  @IsOptional() @IsString() @MaxLength(100)
  shifts?: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt()
  workMinutes?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @Type(() => Number) @IsInt()
  otMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string;
}

export class BulkUpdateDaysDto {
  @ApiProperty({ type: [WorkCalendarDayItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => WorkCalendarDayItemDto)
  days: WorkCalendarDayItemDto[];
}

export class GenerateCalendarDto {
  @ApiPropertyOptional({ description: '주말(토/일) 자동 OFF 여부', default: true })
  @IsOptional()
  weekendOff?: boolean;

  @ApiPropertyOptional({ description: '한국 공휴일 자동 반영', default: true })
  @IsOptional()
  applyHolidays?: boolean;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/modules/master/dto/work-calendar.dto.ts
git commit -m "feat(dto): add work calendar DTOs"
```

---

### Task 5: 서비스 구현 (교대 패턴 + 월력)

**Files:**
- Create: `apps/backend/src/modules/master/services/shift-pattern.service.ts`
- Create: `apps/backend/src/modules/master/services/work-calendar.service.ts`

- [ ] **Step 1: shift-pattern.service.ts 생성**

교대 패턴 CRUD 서비스:
- findAll(company, plant): 교대 패턴 목록
- create(dto, company, plant): 중복 체크 후 생성
- update(shiftCode, dto, company, plant): 수정
- delete(shiftCode, company, plant): 삭제

패턴 참조: `apps/backend/src/modules/master/services/routing-group.service.ts`

- [ ] **Step 2: work-calendar.service.ts 생성**

월력 서비스 — 다음 기능 포함:

1. **월력 헤더 CRUD**: findAll, findById, create, update, delete
2. **연간 일괄 생성** (generateYear):
   - 해당 연도 1/1 ~ 12/31 일자 레코드 생성
   - 토/일 → OFF (REGULAR), 공휴일 → OFF (HOLIDAY), 평일 → WORK
   - 각 WORK일의 shiftCount, shifts, workMinutes는 헤더 기본값으로 채움
   - 트랜잭션으로 기존 데이터 삭제 후 일괄 삽입
3. **복사** (copyFrom): 소스의 모든 일자를 대상 캘린더로 복사 (기존 데이터 삭제 후)
4. **일자 조회/일괄수정**: findDaysByMonth, bulkUpdateDays
5. **확정/취소**: confirm → status='CONFIRMED', unconfirm → status='DRAFT'
   - CONFIRMED 상태에서 update/bulkUpdateDays/delete 호출 시 BadRequestException
6. **집계** (getSummary): 월별 workDays/offDays/totalWorkMinutes/totalOtMinutes

핵심 로직:

```typescript
// 한국 공휴일 (고정일)
const KOREAN_FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1], [3, 1], [5, 5], [6, 6], [8, 15], [10, 3], [10, 9], [12, 25],
];

// WORK_MINUTES 계산
function calcWorkMinutes(dayType: string, shiftWorkMinutes: number, otMinutes: number): number {
  if (dayType === 'OFF') return otMinutes;
  if (dayType === 'HALF') return Math.floor(shiftWorkMinutes / 2) + otMinutes;
  return shiftWorkMinutes + otMinutes; // WORK, SPECIAL
}
```

패턴 참조: `apps/backend/src/modules/master/services/routing-group.service.ts`
- Repository injection + DataSource transaction
- NotFoundException / ConflictException / BadRequestException
- QueryBuilder for filtered list

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/modules/master/services/shift-pattern.service.ts apps/backend/src/modules/master/services/work-calendar.service.ts
git commit -m "feat(service): add ShiftPatternService + WorkCalendarService"
```

---

### Task 6: 컨트롤러 구현 (2개 파일)

**Files:**
- Create: `apps/backend/src/modules/master/controllers/shift-pattern.controller.ts`
- Create: `apps/backend/src/modules/master/controllers/work-calendar.controller.ts`

- [ ] **Step 1: shift-pattern.controller.ts 생성**

```
@ApiTags('기준정보 - 교대패턴')
@Controller('master/shift-patterns')
├─ GET    /                                  findAll
├─ POST   /                                  create
├─ PUT    /:shiftCode                        update
├─ DELETE /:shiftCode                        delete
```

- [ ] **Step 2: work-calendar.controller.ts 생성**

```
@ApiTags('기준정보 - 생산월력')
@Controller('master/work-calendars')
├─ GET    /                                  findAll
├─ GET    /:calendarId                       findOne
├─ POST   /                                  create
├─ PUT    /:calendarId                       update (DRAFT만)
├─ DELETE /:calendarId                       delete (DRAFT만)
├─ POST   /:calendarId/generate              generateYear
├─ POST   /:calendarId/copy-from/:sourceId   copyFrom
├─ GET    /:calendarId/days                  findDays (?month=2026-03)
├─ PUT    /:calendarId/days/bulk             bulkUpdateDays (DRAFT만)
├─ POST   /:calendarId/confirm               confirm
├─ POST   /:calendarId/unconfirm             unconfirm
├─ GET    /:calendarId/summary               getSummary
```

패턴 참조: `apps/backend/src/modules/master/controllers/routing-group.controller.ts`
- @ApiTags, @ApiOperation
- @Company(), @Plant() 데코레이터
- ResponseUtil.paged(), ResponseUtil.success()

- [ ] **Step 3: 커밋**

```bash
git add apps/backend/src/modules/master/controllers/shift-pattern.controller.ts apps/backend/src/modules/master/controllers/work-calendar.controller.ts
git commit -m "feat(controller): add ShiftPatternController + WorkCalendarController"
```

---

### Task 7: 모듈 등록 + 메뉴 코드

**Files:**
- Modify: `apps/backend/src/modules/master/master.module.ts`
- Modify: `apps/backend/src/seeds/menu-config.json`

- [ ] **Step 1: master.module.ts에 등록**

TypeOrmModule.forFeature에 3개 엔티티 추가:
```typescript
import { ShiftPattern } from '../../entities/shift-pattern.entity';
import { WorkCalendar } from '../../entities/work-calendar.entity';
import { WorkCalendarDay } from '../../entities/work-calendar-day.entity';
import { ShiftPatternController } from './controllers/shift-pattern.controller';
import { ShiftPatternService } from './services/shift-pattern.service';
import { WorkCalendarController } from './controllers/work-calendar.controller';
import { WorkCalendarService } from './services/work-calendar.service';
```

controllers에 ShiftPatternController, WorkCalendarController 추가.
providers에 ShiftPatternService, WorkCalendarService 추가.
exports에 ShiftPatternService, WorkCalendarService 추가.

- [ ] **Step 2: menu-config.json에 MST_WORK_CALENDAR 추가**

MASTER 하위 배열에 `"MST_WORK_CALENDAR"` 추가.

- [ ] **Step 3: 백엔드 빌드 확인**

Run: `cd apps/backend && npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: 에러 0건

- [ ] **Step 4: 커밋**

```bash
git add apps/backend/src/modules/master/master.module.ts apps/backend/src/seeds/menu-config.json
git commit -m "feat(master): register work calendar entities/service/controller in module"
```

---

### Task 8: 프론트엔드 메뉴 + i18n 등록

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: menuConfig.ts MASTER children에 추가**

```typescript
{ code: "MST_WORK_CALENDAR", labelKey: "menu.master.workCalendar", path: "/master/work-calendar" },
```

MST_ROUTING 아래에 배치.

- [ ] **Step 2: ko.json — menu 섹션에 추가**

```json
"master.workCalendar": "생산월력관리"
```

그리고 `master` 객체 내부에 workCalendar 섹션 추가:
```json
"workCalendar": {
  "title": "생산월력관리",
  "subtitle": "연간 작업일정을 등록하고 관리합니다.",
  "calendarId": "캘린더ID",
  "calendarYear": "연도",
  "processCd": "공정",
  "allProcesses": "전체 (공장기본)",
  "defaultShiftCount": "기본교대수",
  "defaultShifts": "기본교대패턴",
  "status": "상태",
  "generate": "연간 생성",
  "generateConfirm": "해당 연도의 작업일정을 생성하시겠습니까?",
  "copyFrom": "다른 캘린더에서 복사",
  "copyConfirm": "기존 일자 데이터를 덮어씁니다. 복사하시겠습니까?",
  "confirm": "확정",
  "unconfirm": "확정취소",
  "confirmMsg": "캘린더를 확정하시겠습니까? 확정 후에는 수정할 수 없습니다.",
  "unconfirmMsg": "확정을 취소하시겠습니까?",
  "dayType": "근무유형",
  "offReason": "휴무사유",
  "shiftCount": "교대수",
  "shifts": "교대패턴",
  "workMinutes": "가용시간(분)",
  "otMinutes": "잔업시간(분)",
  "workDays": "가동일수",
  "offDays": "비가동일수",
  "totalMinutes": "총가용시간",
  "shiftPattern": "교대 패턴",
  "shiftCode": "교대코드",
  "shiftName": "교대명",
  "startTime": "시작시간",
  "endTime": "종료시간",
  "breakMinutes": "휴식시간(분)",
  "monthly": "월별 현황",
  "editDay": "일자 편집",
  "bulkEdit": "일괄 편집"
}
```

- [ ] **Step 3: en.json, zh.json, vi.json에 동일 구조 번역 추가**

- [ ] **Step 4: Grep으로 4파일에 키 존재 확인**

Run: `grep -l "workCalendar" apps/frontend/src/locales/*.json`
Expected: ko.json, en.json, zh.json, vi.json 4개 파일

- [ ] **Step 5: 커밋**

```bash
git add apps/frontend/src/config/menuConfig.ts apps/frontend/src/locales/*.json
git commit -m "feat(i18n): add work calendar menu and translations (ko/en/zh/vi)"
```

---

### Task 9: 프론트엔드 — 달력 그리드 컴포넌트

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/components/CalendarGrid.tsx`

- [ ] **Step 1: CalendarGrid 컴포넌트 생성**

기능:
- 월 선택 (이전/다음 월 네비게이션)
- 7x5~6 그리드로 날짜 렌더링
- DAY_TYPE별 색상: WORK=파랑, OFF=빨강, HALF=노랑, SPECIAL=초록
- 날짜 클릭 → onDayClick 콜백 (DayEditModal 열기)
- 범위 선택(드래그) → onRangeSelect 콜백 (일괄 편집)
- 월별 요약 (가동일수/비가동일수/총가용시간) 하단 표시
- ComCodeBadge 사용하여 DAY_TYPE 표시

Props: `calendarId, month, days[], onDayClick, onRangeSelect, onMonthChange`

최대 200줄.

- [ ] **Step 2: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/master/work-calendar/components/CalendarGrid.tsx
git commit -m "feat(frontend): add CalendarGrid component with day-type colors"
```

---

### Task 10: 프론트엔드 — 일자 편집 모달

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/components/DayEditModal.tsx`

- [ ] **Step 1: DayEditModal 컴포넌트 생성**

기능:
- DAY_TYPE 셀렉트 (공통코드 WORK_DAY_TYPE — useComCodeOptions 사용)
- OFF_REASON 셀렉트 (공통코드 DAY_OFF_TYPE — dayType이 OFF일 때만 표시)
- SHIFT_COUNT 입력 (1~3)
- SHIFTS 입력 (교대 패턴 선택 — API에서 교대 목록 조회)
- OT_MINUTES 입력
- REMARK 텍스트
- 일괄 편집 모드: 선택된 날짜 범위에 동일 설정 적용

Props: `isOpen, onClose, selectedDates, currentData, onSave`

최대 200줄.

- [ ] **Step 2: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/master/work-calendar/components/DayEditModal.tsx
git commit -m "feat(frontend): add DayEditModal with ComCode selects"
```

---

### Task 11: 프론트엔드 — 캘린더 폼 패널

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/components/CalendarFormPanel.tsx`

- [ ] **Step 1: CalendarFormPanel 컴포넌트 생성**

기능:
- 캘린더 헤더 폼: calendarId, calendarYear, processCd(공정 셀렉트), defaultShiftCount, defaultShifts, status, remark
- 버튼: 저장, 연간생성, 복사, 확정/확정취소
- 상태에 따라 버튼 활성화/비활성화 (CONFIRMED → 수정 불가)

Props: `calendar, onSave, onGenerate, onCopy, onConfirm, onUnconfirm`

최대 200줄.

- [ ] **Step 2: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/master/work-calendar/components/CalendarFormPanel.tsx
git commit -m "feat(frontend): add CalendarFormPanel with status workflow buttons"
```

---

### Task 12: 프론트엔드 — 교대 패턴 탭

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/components/ShiftPatternTab.tsx`

- [ ] **Step 1: ShiftPatternTab 컴포넌트 생성**

기능:
- 교대 패턴 목록 (DataGrid)
- 추가/수정/삭제 인라인 또는 모달
- shiftCode, shiftName, startTime, endTime, breakMinutes, workMinutes, sortOrder

최대 200줄.

- [ ] **Step 2: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/master/work-calendar/components/ShiftPatternTab.tsx
git commit -m "feat(frontend): add ShiftPatternTab for shift pattern CRUD"
```

---

### Task 13: 프론트엔드 — 메인 페이지

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/work-calendar/page.tsx`

- [ ] **Step 1: page.tsx 생성**

레이아웃:
- 헤더: 타이틀 + 새로고침 + 추가 버튼
- 탭: "월력관리" / "교대패턴"
- 월력관리 탭:
  - 좌측(col-4): 캘린더 목록 DataGrid (연도/공정 필터)
  - 우측(col-8): 상단 CalendarFormPanel + 하단 CalendarGrid
- 교대패턴 탭: ShiftPatternTab

API 호출:
- GET /master/work-calendars (목록)
- GET /master/work-calendars/:id (상세)
- GET /master/work-calendars/:id/days?month=YYYY-MM (일자)
- POST/PUT/DELETE 등

최대 300줄.

- [ ] **Step 2: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/master/work-calendar/page.tsx
git commit -m "feat(frontend): add work calendar management page"
```

---

### Task 14: 빌드 검증 + 최종 커밋

**Files:**
- 전체 프로젝트

- [ ] **Step 1: 백엔드 빌드**

Run: `cd apps/backend && npx tsc --noEmit --pretty 2>&1 | tail -10`
Expected: 에러 0건

- [ ] **Step 2: 프론트엔드 빌드**

Run: `cd apps/frontend && npx next build 2>&1 | tail -20`
Expected: 에러 0건

- [ ] **Step 3: i18n 키 검증**

Run: `grep -c "workCalendar" apps/frontend/src/locales/*.json`
Expected: 4개 파일 모두 매칭

- [ ] **Step 4: 에러가 있으면 수정 후 커밋**

```bash
git add -A
git commit -m "fix: resolve build errors in work calendar feature"
```

---

## 공통코드 시드 (별도 실행)

구현 완료 후 oracle-db 스킬로 공통코드 INSERT:

```sql
-- WORK_DAY_TYPE
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('WORK_DAY_TYPE', 'WORK', '근무일', 1, 'Y', 'HANES');
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('WORK_DAY_TYPE', 'OFF', '휴무일', 2, 'Y', 'HANES');
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('WORK_DAY_TYPE', 'HALF', '반일근무', 3, 'Y', 'HANES');
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('WORK_DAY_TYPE', 'SPECIAL', '특근', 4, 'Y', 'HANES');

-- DAY_OFF_TYPE
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('DAY_OFF_TYPE', 'HOLIDAY', '공휴일', 1, 'Y', 'HANES');
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('DAY_OFF_TYPE', 'REGULAR', '정기휴무', 2, 'Y', 'HANES');
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('DAY_OFF_TYPE', 'MAINTENANCE', '설비보전', 3, 'Y', 'HANES');
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('DAY_OFF_TYPE', 'COMPANY', '회사휴무', 4, 'Y', 'HANES');
INSERT INTO COM_CODES (GROUP_CODE, CODE, CODE_NAME, SORT_ORDER, USE_YN, COMPANY) VALUES ('DAY_OFF_TYPE', 'OTHER', '기타', 5, 'Y', 'HANES');
COMMIT;
```
