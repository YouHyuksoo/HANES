# 설비점검·자주검사 통합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라우팅 페이지에 "자주검사 설정" 3번째 탭 추가, 의뢰검사 입력 페이지(`/quality/request-inspect`), 자주검사 이력 조회 페이지(`/quality/self-inspect-history`) 신규 구현

**Architecture:**
- `ROUTING_PROCESSES` 테이블에 QC 관련 컬럼 4개 추가 (DB Migration → Entity → DTO 순서)
- 기존 `SelfInspectService`에 item CRUD 및 history 조회 메서드 추가, 컨트롤러에 신규 엔드포인트 추가
- 프론트엔드: 라우팅 페이지 우측 패널에 3번째 탭, 신규 quality 페이지 2개, menuConfig + i18n 4파일 업데이트

**Tech Stack:** NestJS, TypeORM, Oracle DB, Next.js 14, Zustand, react-i18next, Tailwind CSS

---

## 파일 구조

| 작업 | 경로 | 유형 |
|------|------|------|
| Task 1 | `apps/backend/src/migrations/2026-05-22_add_qc_columns_to_routing_processes.sql` | 신규 |
| Task 2 | `apps/backend/src/entities/routing-process.entity.ts` | 수정 |
| Task 2 | `apps/backend/src/modules/master/dto/routing-group.dto.ts` | 수정 |
| Task 2 | `apps/backend/src/modules/master/services/routing-group.service.ts` | 수정 |
| Task 3 | `apps/backend/src/modules/production/services/self-inspect.service.ts` | 수정 |
| Task 3 | `apps/backend/src/modules/production/controllers/self-inspect.controller.ts` | 수정 |
| Task 4 | `apps/frontend/src/app/(authenticated)/master/routing/page.tsx` | 수정 |
| Task 4 | `apps/frontend/src/app/(authenticated)/master/routing/components/SelfInspectConfigEditor.tsx` | 신규 |
| Task 5 | `apps/frontend/src/app/(authenticated)/quality/request-inspect/page.tsx` | 신규 |
| Task 6 | `apps/frontend/src/app/(authenticated)/quality/self-inspect-history/page.tsx` | 신규 |
| Task 7 | `apps/frontend/src/config/menuConfig.ts` | 수정 |
| Task 7 | `apps/frontend/src/locales/ko.json` + `en.json` + `zh.json` + `vi.json` | 수정 |

---

## Task 1: DB Migration — ROUTING_PROCESSES 컬럼 추가

**Files:**
- Create: `apps/backend/src/migrations/2026-05-22_add_qc_columns_to_routing_processes.sql`

### 배경

`ROUTING_PROCESSES` 테이블에 공정 레벨 자주검사 설정 컬럼 4개를 추가한다.
이 값은 라우팅 공정 수준의 기본값으로, `SELF_INSPECT_ITEMS`의 개별 항목 설정과 별개다.
(`/master/routing` 페이지의 RoutingGroup + RoutingProcess 구조에서 사용하는 테이블이다)

- [ ] **Step 1: 마이그레이션 SQL 파일 작성**

```sql
-- 2026-05-22: ROUTING_PROCESSES에 자주검사 설정 컬럼 추가
-- 실행 전 반드시 JSHANES 사이트에서 실행할 것

ALTER TABLE ROUTING_PROCESSES ADD QC_SELF_YN VARCHAR2(1) DEFAULT 'N';
ALTER TABLE ROUTING_PROCESSES ADD INSPECT_METHOD VARCHAR2(20) DEFAULT 'DIRECT';
ALTER TABLE ROUTING_PROCESSES ADD DESTRUCTIVE_YN VARCHAR2(1) DEFAULT 'N';
ALTER TABLE ROUTING_PROCESSES ADD SAMPLE_QTY NUMBER DEFAULT 1;

COMMENT ON COLUMN ROUTING_PROCESSES.QC_SELF_YN IS '자주검사 수행 여부 (Y/N)';
COMMENT ON COLUMN ROUTING_PROCESSES.INSPECT_METHOD IS '기본 검사방법 (DIRECT/DELEGATE)';
COMMENT ON COLUMN ROUTING_PROCESSES.DESTRUCTIVE_YN IS '파괴검사 여부 (Y/N)';
COMMENT ON COLUMN ROUTING_PROCESSES.SAMPLE_QTY IS '기본 샘플 수량';

COMMIT;
```

- [ ] **Step 2: SQL 실행 확인 명령**

```bash
# SQL Developer 또는 sqlplus에서 실행 후 확인
# SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_DEFAULT 
# FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'ROUTING_PROCESSES' 
# AND COLUMN_NAME IN ('QC_SELF_YN','INSPECT_METHOD','DESTRUCTIVE_YN','SAMPLE_QTY');
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/migrations/2026-05-22_add_qc_columns_to_routing_processes.sql
git commit -m "feat: add QC columns to ROUTING_PROCESSES table"
```

---

## Task 2: Backend — RoutingProcess 엔티티 + DTO + Service 업데이트

**Files:**
- Modify: `apps/backend/src/entities/routing-process.entity.ts`
- Modify: `apps/backend/src/modules/master/dto/routing-group.dto.ts`
- Modify: `apps/backend/src/modules/master/services/routing-group.service.ts`

### routing-process.entity.ts 수정

`RoutingProcess` 엔티티(테이블 `ROUTING_PROCESSES`, PK: routingCode+seq 복합키)에 4개 컬럼 추가.
`useYn` 컬럼 선언 바로 아래에 삽입.

- [ ] **Step 1: RoutingProcess 엔티티에 컬럼 추가**

`apps/backend/src/entities/routing-process.entity.ts` 의 `useYn` 컬럼 선언 바로 아래에 삽입:

```typescript
  @Column({ type: 'varchar2', name: 'QC_SELF_YN', length: 1, default: 'N', nullable: true })
  qcSelfYn: string | null;

  @Column({ type: 'varchar2', name: 'INSPECT_METHOD', length: 20, default: 'DIRECT', nullable: true })
  inspectMethod: string | null;

  @Column({ type: 'varchar2', name: 'DESTRUCTIVE_YN', length: 1, default: 'N', nullable: true })
  destructiveYn: string | null;

  @Column({ name: 'SAMPLE_QTY', type: 'number', default: 1, nullable: true })
  sampleQty: number | null;
```

- [ ] **Step 2: CreateRoutingProcessDto에 필드 추가**

`apps/backend/src/modules/master/dto/routing-group.dto.ts` 의 `CreateRoutingProcessDto` 클래스 내
`useYn` 필드 선언 위에 삽입:

```typescript
  @ApiPropertyOptional({ description: '자주검사 여부', default: 'N' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  qcSelfYn?: string;

  @ApiPropertyOptional({ description: '기본 검사방법 (DIRECT/DELEGATE)', default: 'DIRECT' })
  @IsOptional()
  @IsString()
  @IsIn(['DIRECT', 'DELEGATE'])
  inspectMethod?: string;

  @ApiPropertyOptional({ description: '파괴검사 여부', default: 'N' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  destructiveYn?: string;

  @ApiPropertyOptional({ description: '기본 샘플 수량', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sampleQty?: number;
```

- [ ] **Step 3: routing-group.service.ts createProcess() + updateProcess() 에 신규 필드 매핑 추가**

`apps/backend/src/modules/master/services/routing-group.service.ts` 의 `createProcess()` 메서드에서
`useYn: dto.useYn ?? 'Y',` 바로 아래에 추가:

```typescript
      qcSelfYn: dto.qcSelfYn ?? 'N',
      inspectMethod: dto.inspectMethod ?? 'DIRECT',
      destructiveYn: dto.destructiveYn ?? 'N',
      sampleQty: dto.sampleQty ?? 1,
```

`updateProcess()` 메서드가 `Object.assign(process, dto)` 또는 개별 필드 할당 패턴이면
기존 패턴에 맞춰 동일한 4개 필드도 포함되도록 수정한다.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/entities/routing-process.entity.ts \
        apps/backend/src/modules/master/dto/routing-group.dto.ts \
        apps/backend/src/modules/master/services/routing-group.service.ts
git commit -m "feat: add QC columns to RoutingProcess entity and routing-group DTO"
```

---

## Task 3: Backend — SelfInspect item CRUD + history 엔드포인트 추가

**Files:**
- Modify: `apps/backend/src/modules/production/services/self-inspect.service.ts`
- Modify: `apps/backend/src/modules/production/controllers/self-inspect.controller.ts`

### 추가할 API 목록

| Method | Path | 설명 |
|--------|------|------|
| GET | `/production/self-inspect/items/all` | processCode 기준 전체 항목 조회 (timing 무관, 관리용) |
| POST | `/production/self-inspect/items` | 항목 생성 |
| PUT | `/production/self-inspect/items/:id` | 항목 수정 |
| DELETE | `/production/self-inspect/items/:id` | 항목 삭제 |
| GET | `/production/self-inspect/history` | 이력 목록 (dateFrom, dateTo, orderNo, processCode 필터) |

- [ ] **Step 1: updateResultStatus에 measureValue 파라미터 추가 (버그 수정)**

기존 `updateResultStatus(id, status, remark?)` 는 `measureValue`를 받지 않아 값이 유실된다.
`apps/backend/src/modules/production/services/self-inspect.service.ts` 의 `updateResultStatus` 메서드 시그니처를 수정:

```typescript
  async updateResultStatus(
    id: string,
    status: string,
    remark?: string,
    measureValue?: number,
  ) {
    const result = await this.resultRepo.findOne({ where: { id } });
    if (!result) throw new NotFoundException(`SelfInspectResult ${id} not found`);
    result.status = status;
    if (remark !== undefined) result.remark = remark;
    if (measureValue !== undefined) result.measureValue = measureValue;
    return this.resultRepo.save(result);
  }
```

그리고 `apps/backend/src/modules/production/controllers/self-inspect.controller.ts` 의
`PATCH results/:id/status` 핸들러를 수정하여 body에서 `measureValue`를 받도록 변경:

```typescript
  @Patch('results/:id/status')
  @ApiOperation({ summary: '자주검사 결과 상태 업데이트' })
  async updateResultStatus(
    @Param('id') id: string,
    @Body() body: { status: string; remark?: string; measureValue?: number },
  ) {
    const data = await this.svc.updateResultStatus(
      id,
      body.status,
      body.remark,
      body.measureValue,
    );
    return ResponseUtil.success(data);
  }
```

- [ ] **Step 2: SelfInspectService에 item CRUD 및 history 메서드 추가**

`apps/backend/src/modules/production/services/self-inspect.service.ts` 의 `findPendingDelegates` 메서드 이후에 아래 메서드들을 추가한다:

```typescript
  /** 자주검사 항목 전체 조회 (관리 화면용 — timing 필터 없음) */
  async findAllItems(processCode: string, company?: string, plant?: string) {
    const qb = this.itemRepo.createQueryBuilder('i')
      .where('i.processCode = :pc', { pc: processCode })
      .orderBy('i.sortOrder', 'ASC')
      .addOrderBy('i.createdAt', 'ASC');
    if (company) qb.andWhere('(i.company = :company OR i.company IS NULL)', { company });
    if (plant) qb.andWhere('(i.plant = :plant OR i.plant IS NULL)', { plant });
    return qb.getMany();
  }

  /** 자주검사 항목 생성 */
  async createItem(dto: {
    processCode: string;
    itemName: string;
    standard?: string | null;
    inspectMethod?: string;
    timing?: string;
    isDestructive?: boolean;
    sortOrder?: number;
    useYn?: string;
    itemType?: string;
    unit?: string | null;
    lslValue?: number | null;
    uslValue?: number | null;
    sampleCount?: number;
  }, company: string, plant: string) {
    const item = this.itemRepo.create({
      ...dto,
      inspectMethod: dto.inspectMethod ?? 'DIRECT',
      timing: dto.timing ?? 'MID',
      isDestructive: dto.isDestructive ?? false,
      sortOrder: dto.sortOrder ?? 0,
      useYn: dto.useYn ?? 'Y',
      itemType: dto.itemType ?? 'VISUAL',
      sampleCount: dto.sampleCount ?? 1,
      company,
      plant,
    });
    return this.itemRepo.save(item);
  }

  /** 자주검사 항목 수정 */
  async updateItem(id: string, dto: {
    itemName?: string;
    standard?: string | null;
    inspectMethod?: string;
    timing?: string;
    isDestructive?: boolean;
    sortOrder?: number;
    useYn?: string;
    itemType?: string;
    unit?: string | null;
    lslValue?: number | null;
    uslValue?: number | null;
    sampleCount?: number;
  }) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`SelfInspectItem ${id} not found`);
    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  /** 자주검사 항목 삭제 */
  async deleteItem(id: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`SelfInspectItem ${id} not found`);
    await this.itemRepo.remove(item);
    return { id };
  }

  /** 자주검사 이력 목록 조회 (페이지네이션) */
  async findHistory(query: {
    dateFrom?: string;
    dateTo?: string;
    orderNo?: string;
    processCode?: string;
    page?: number;
    limit?: number;
  }, company: string, plant: string) {
    const { dateFrom, dateTo, orderNo, processCode, page = 1, limit = 30 } = query;
    const skip = (page - 1) * limit;

    const qb = this.resultRepo.createQueryBuilder('r')
      .where('r.company = :company AND r.plant = :plant', { company, plant })
      .orderBy('r.createdAt', 'DESC');

    if (orderNo) qb.andWhere('r.orderNo LIKE :ono', { ono: `%${orderNo}%` });
    if (processCode) qb.andWhere('r.processCode = :pc', { pc: processCode });
    if (dateFrom) qb.andWhere('r.createdAt >= :df', { df: new Date(dateFrom) });
    if (dateTo) {
      const dt = new Date(dateTo);
      dt.setDate(dt.getDate() + 1);
      qb.andWhere('r.createdAt < :dt', { dt });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { data, total, page, limit };
  }
```

- [ ] **Step 3: SelfInspectController에 신규 엔드포인트 추가**

`apps/backend/src/modules/production/controllers/self-inspect.controller.ts` 에서 import에 `Delete, Put, ParseIntPipe` 추가 후,
`findPendingDelegates` 핸들러 이후에 아래를 추가한다:

```typescript
  @Get('items/all')
  @ApiOperation({ summary: '자주검사 항목 전체 조회 (관리용, timing 무관)' })
  @ApiQuery({ name: 'processCode', required: true })
  async findAllItems(
    @Query('processCode') processCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.findAllItems(processCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '자주검사 항목 생성' })
  async createItem(
    @Body() dto: {
      processCode: string;
      itemName: string;
      standard?: string | null;
      inspectMethod?: string;
      timing?: string;
      isDestructive?: boolean;
      sortOrder?: number;
      useYn?: string;
      itemType?: string;
      unit?: string | null;
      lslValue?: number | null;
      uslValue?: number | null;
      sampleCount?: number;
    },
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.createItem(dto, company, plant);
    return ResponseUtil.success(data, '자주검사 항목이 생성되었습니다');
  }

  @Put('items/:id')
  @ApiOperation({ summary: '자주검사 항목 수정' })
  async updateItem(
    @Param('id') id: string,
    @Body() dto: {
      itemName?: string;
      standard?: string | null;
      inspectMethod?: string;
      timing?: string;
      isDestructive?: boolean;
      sortOrder?: number;
      useYn?: string;
      itemType?: string;
      unit?: string | null;
      lslValue?: number | null;
      uslValue?: number | null;
      sampleCount?: number;
    },
  ) {
    const data = await this.svc.updateItem(id, dto);
    return ResponseUtil.success(data, '자주검사 항목이 수정되었습니다');
  }

  @Delete('items/:id')
  @ApiOperation({ summary: '자주검사 항목 삭제' })
  async deleteItem(@Param('id') id: string) {
    const data = await this.svc.deleteItem(id);
    return ResponseUtil.success(data, '자주검사 항목이 삭제되었습니다');
  }

  @Get('history')
  @ApiOperation({ summary: '자주검사 이력 목록 조회' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'orderNo', required: false })
  @ApiQuery({ name: 'processCode', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findHistory(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('orderNo') orderNo?: string,
    @Query('processCode') processCode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const result = await this.svc.findHistory(
      {
        dateFrom,
        dateTo,
        orderNo,
        processCode,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 30,
      },
      company ?? '',
      plant ?? '',
    );
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }
```

**주의:** `Delete`를 import에 추가해야 한다. controller 상단 import 라인:
```typescript
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Put, Query, UseGuards,
} from '@nestjs/common';
```

- [ ] **Step 4: API curl 테스트 (개발서버가 실행 중인 경우)**

```bash
# 항목 전체 조회 테스트 (processCode는 실제 값으로 교체)
curl -s -H "x-company: JSHANES" -H "x-plant: JSHANES" \
     -H "Authorization: Bearer <token>" \
     "http://localhost:3001/production/self-inspect/items/all?processCode=CUT-01" | jq .
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/production/services/self-inspect.service.ts \
        apps/backend/src/modules/production/controllers/self-inspect.controller.ts
git commit -m "feat: add measureValue fix and self-inspect item CRUD + history API endpoints"
```

---

## Task 4: Frontend — 라우팅 페이지 3번째 탭 (SelfInspectConfigEditor)

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/routing/page.tsx`
- Create: `apps/frontend/src/app/(authenticated)/master/routing/components/SelfInspectConfigEditor.tsx`

### SelfInspectConfigEditor 설계

선택된 공정의 `processCode`를 기반으로 `SELF_INSPECT_ITEMS`를 CRUD하는 에디터.
행마다 편집 가능하며, 추가·삭제 지원.

| 컬럼 | 입력 유형 |
|------|----------|
| 항목명 (itemName) | text input |
| 기준 (standard) | text input (optional) |
| 유형 (itemType) | select: MEASURE / VISUAL |
| 검사방법 (inspectMethod) | select: DIRECT / DELEGATE |
| 시점 (timing) | checkbox group: FIRST / MID / LAST |
| 파괴 (isDestructive) | checkbox |
| 단위 (unit) | text input (optional, MEASURE only) |
| LSL / USL | number input (optional, MEASURE only) |
| 샘플수 (sampleCount) | number input |
| 순서 (sortOrder) | number input |
| 사용 (useYn) | select: Y / N |

- [ ] **Step 1: `SelfInspectConfigEditor.tsx` 신규 파일 작성**

`apps/frontend/src/app/(authenticated)/master/routing/components/SelfInspectConfigEditor.tsx`:

```typescript
"use client";

/**
 * @file components/SelfInspectConfigEditor.tsx
 * @description 공정별 자주검사 항목 CRUD 에디터
 *
 * 초보자 가이드:
 * 1. selectedProcess.processCode 기준으로 SELF_INSPECT_ITEMS 조회/편집
 * 2. 행 추가 → 상단에 빈 행 추가, 저장 버튼으로 POST
 * 3. 기존 행 수정 → 인라인 편집 후 저장 버튼으로 PUT
 * 4. 삭제 아이콘 → 확인 없이 즉시 DELETE (취소불가 안내)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/services/api";
import type { SelectedProcess } from "../types";

interface SelfInspectItem {
  id: string;
  processCode: string | null;
  itemName: string;
  standard: string | null;
  inspectMethod: string;
  timing: string;
  isDestructive: boolean;
  sortOrder: number;
  useYn: string;
  itemType: string;
  unit: string | null;
  lslValue: number | null;
  uslValue: number | null;
  sampleCount: number;
}

type EditRow = Omit<SelfInspectItem, "id"> & { id: string | null; dirty: boolean };

interface Props {
  selectedProcess: SelectedProcess;
}

const TIMING_OPTIONS = ["FIRST", "MID", "LAST"] as const;

export default function SelfInspectConfigEditor({ selectedProcess }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<EditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/self-inspect/items/all", {
        params: { processCode: selectedProcess.processCode },
      });
      const items: SelfInspectItem[] = res.data?.data ?? [];
      setRows(items.map((item) => ({ ...item, dirty: false })));
    } catch {
      toast.error(t("common.loadError", "조회 중 오류"));
    } finally {
      setLoading(false);
    }
  }, [selectedProcess.processCode, t]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const handleAdd = () => {
    const newRow: EditRow = {
      id: null,
      processCode: selectedProcess.processCode,
      itemName: "",
      standard: null,
      inspectMethod: "DIRECT",
      timing: "MID",
      isDestructive: false,
      sortOrder: rows.length * 10,
      useYn: "Y",
      itemType: "VISUAL",
      unit: null,
      lslValue: null,
      uslValue: null,
      sampleCount: 1,
      dirty: true,
    };
    setRows((prev) => [newRow, ...prev]);
  };

  const handleChange = (idx: number, field: keyof EditRow, value: unknown) => {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value, dirty: true } : row))
    );
  };

  const handleTimingToggle = (idx: number, timing: string) => {
    const row = rows[idx];
    const parts = row.timing ? row.timing.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const next = parts.includes(timing)
      ? parts.filter((p) => p !== timing)
      : [...parts, timing];
    handleChange(idx, "timing", next.join(",") || "MID");
  };

  const handleSave = async (idx: number) => {
    const row = rows[idx];
    if (!row.itemName.trim()) {
      toast.error(t("selfInspect.itemNameRequired", "항목명을 입력하세요"));
      return;
    }
    try {
      if (row.id) {
        const res = await api.put(`/production/self-inspect/items/${row.id}`, row);
        const updated = res.data?.data as SelfInspectItem;
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...updated, dirty: false } : r))
        );
      } else {
        const res = await api.post("/production/self-inspect/items", {
          ...row,
          processCode: selectedProcess.processCode,
        });
        const created = res.data?.data as SelfInspectItem;
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...created, dirty: false } : r))
        );
      }
      toast.success(t("common.saved", "저장되었습니다"));
    } catch {
      toast.error(t("common.saveError", "저장 중 오류"));
    }
  };

  const handleDelete = async (idx: number) => {
    const row = rows[idx];
    if (!row.id) {
      setRows((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    try {
      await api.delete(`/production/self-inspect/items/${row.id}`);
      setRows((prev) => prev.filter((_, i) => i !== idx));
      toast.success(t("common.deleted", "삭제되었습니다"));
    } catch {
      toast.error(t("common.deleteError", "삭제 중 오류"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        {t("common.loading", "조회 중...")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex justify-between items-center shrink-0">
        <span className="text-xs text-text-muted">
          {selectedProcess.processName} ({selectedProcess.processCode})
        </span>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3 h-3" />
          {t("selfInspect.addItem", "항목 추가")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            {t("selfInspect.noItems", "등록된 자주검사 항목이 없습니다")}
          </div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row.id ?? `new-${idx}`}
              className={`p-3 rounded-lg border text-xs space-y-2 ${
                row.dirty
                  ? "border-orange-300 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-950/20"
                  : "border-border bg-surface/50"
              }`}
            >
              {/* 항목명 + 유형 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={row.itemName}
                  onChange={(e) => handleChange(idx, "itemName", e.target.value)}
                  placeholder={t("selfInspect.itemName", "항목명")}
                  className="flex-1 px-2 py-1 border border-border rounded bg-background text-text focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
                <select
                  value={row.itemType}
                  onChange={(e) => handleChange(idx, "itemType", e.target.value)}
                  className="w-24 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                >
                  <option value="VISUAL">판정형</option>
                  <option value="MEASURE">측정형</option>
                </select>
              </div>

              {/* 기준 */}
              <input
                type="text"
                value={row.standard ?? ""}
                onChange={(e) => handleChange(idx, "standard", e.target.value || null)}
                placeholder={t("selfInspect.standard", "기준/규격 (선택)")}
                className="w-full px-2 py-1 border border-border rounded bg-background text-text focus:outline-none focus:ring-1 focus:ring-primary text-xs"
              />

              {/* 측정형일 때: 단위 + LSL + USL */}
              {row.itemType === "MEASURE" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={row.unit ?? ""}
                    onChange={(e) => handleChange(idx, "unit", e.target.value || null)}
                    placeholder="단위"
                    className="w-16 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  />
                  <input
                    type="number"
                    value={row.lslValue ?? ""}
                    onChange={(e) =>
                      handleChange(idx, "lslValue", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="LSL"
                    className="w-20 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  />
                  <input
                    type="number"
                    value={row.uslValue ?? ""}
                    onChange={(e) =>
                      handleChange(idx, "uslValue", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="USL"
                    className="w-20 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  />
                </div>
              )}

              {/* 검사방법 + 샘플수 */}
              <div className="flex gap-2 items-center">
                <select
                  value={row.inspectMethod}
                  onChange={(e) => handleChange(idx, "inspectMethod", e.target.value)}
                  className="w-24 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                >
                  <option value="DIRECT">직접검사</option>
                  <option value="DELEGATE">의뢰검사</option>
                </select>
                <label className="flex items-center gap-1 text-text-muted">
                  <span>샘플수</span>
                  <input
                    type="number"
                    min={1}
                    value={row.sampleCount}
                    onChange={(e) => handleChange(idx, "sampleCount", Number(e.target.value))}
                    className="w-14 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  />
                </label>
                <label className="flex items-center gap-1 text-text-muted">
                  <input
                    type="checkbox"
                    checked={row.isDestructive}
                    onChange={(e) => handleChange(idx, "isDestructive", e.target.checked)}
                    className="rounded"
                  />
                  <span>파괴</span>
                </label>
              </div>

              {/* 검사시점 체크박스 */}
              <div className="flex gap-2 items-center">
                <span className="text-text-muted">시점:</span>
                {TIMING_OPTIONS.map((t) => (
                  <label key={t} className="flex items-center gap-1 text-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.timing.includes(t)}
                      onChange={() => handleTimingToggle(idx, t)}
                      className="rounded"
                    />
                    <span>{t === "FIRST" ? "초물" : t === "MID" ? "중물" : "종물"}</span>
                  </label>
                ))}
              </div>

              {/* 순서 + 사용여부 + 저장/삭제 */}
              <div className="flex gap-2 items-center justify-between">
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-1 text-text-muted">
                    <span>순서</span>
                    <input
                      type="number"
                      value={row.sortOrder}
                      onChange={(e) => handleChange(idx, "sortOrder", Number(e.target.value))}
                      className="w-14 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                    />
                  </label>
                  <select
                    value={row.useYn}
                    onChange={(e) => handleChange(idx, "useYn", e.target.value)}
                    className="w-16 px-2 py-1 border border-border rounded bg-background text-text text-xs"
                  >
                    <option value="Y">사용</option>
                    <option value="N">미사용</option>
                  </select>
                </div>
                <div className="flex gap-1">
                  {row.dirty && (
                    <button
                      type="button"
                      onClick={() => handleSave(idx)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90"
                    >
                      <Save className="w-3 h-3" />
                      저장
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: routing/page.tsx 에 3번째 탭 추가**

`apps/frontend/src/app/(authenticated)/master/routing/page.tsx` 파일을 수정한다.

**(a) import 추가** — 기존 import 블록 아래에:
```typescript
import SelfInspectConfigEditor from "./components/SelfInspectConfigEditor";
```

**(b) state 타입 변경** — `activeDetailTab` 상태를:
```typescript
// 기존
const [activeDetailTab, setActiveDetailTab] = useState<"conditions" | "materials">("conditions");
// 변경 후
const [activeDetailTab, setActiveDetailTab] = useState<"conditions" | "materials" | "selfinspect">("conditions");
```

**(c) 탭 버튼 추가** — 기존 "투입자재" 탭 버튼 바로 아래에:
```typescript
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("selfinspect")}
                      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                        activeDetailTab === "selfinspect"
                          ? "border-primary text-primary"
                          : "border-transparent text-text-muted dark:text-gray-400 hover:text-text dark:hover:text-gray-200"
                      }`}
                    >
                      {t("master.routing.selfInspectEditorTitle", "자주검사 설정")}
                    </button>
```

**(d) 탭 패널 조건 추가** — 기존 `RoutingMaterialEditor` 렌더 조건 블록을:
```typescript
                    {activeDetailTab === "conditions" ? (
                      <QualityConditionEditor selectedProcess={selectedProcess} />
                    ) : activeDetailTab === "materials" ? (
                      <RoutingMaterialEditor selectedProcess={selectedProcess} />
                    ) : (
                      <SelfInspectConfigEditor selectedProcess={selectedProcess} />
                    )}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/app/(authenticated)/master/routing/page.tsx \
        apps/frontend/src/app/(authenticated)/master/routing/components/SelfInspectConfigEditor.tsx
git commit -m "feat: add self-inspect config tab to routing page"
```

---

## Task 5: Frontend — `/quality/request-inspect` 페이지 (의뢰검사 입력)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/request-inspect/page.tsx`

### 화면 구조

- **좌측 패널 (col-span-5)**: 의뢰검사 대기 목록 (`GET /production/self-inspect/delegates`)
  - 컬럼: 작업지시번호, 공정코드, 항목명, 검사시점, 등록일시
  - 행 클릭 → 우측 패널에 상세 표시
- **우측 패널 (col-span-7)**: 선택된 항목 상세 + 결과 입력
  - 표시: 항목명, 기준, 단위, LSL/USL (있을 경우)
  - 입력: 측정값(MEASURE), 판정(PASS/FAIL), 비고
  - 저장: `PATCH /production/self-inspect/results/:id/status`

- [ ] **Step 1: 페이지 파일 작성**

`apps/frontend/src/app/(authenticated)/quality/request-inspect/page.tsx`:

```typescript
"use client";

/**
 * @file src/app/(authenticated)/quality/request-inspect/page.tsx
 * @description 의뢰검사 입력 페이지 — DELEGATE 방식 자주검사 결과 입력
 *
 * 초보자 가이드:
 * 1. 좌측: 의뢰검사 대기(PENDING) 목록 조회
 * 2. 우측: 선택 항목의 측정값/판정 입력
 * 3. 저장: PATCH /production/self-inspect/results/:id/status
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, CardContent } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface DelegateItem {
  id: string;
  orderNo: string;
  processCode: string | null;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  remark: string | null;
  measureValue: number | null;
  sampleNo: number;
  createdAt: string;
}

export default function RequestInspectPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<DelegateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DelegateItem | null>(null);
  const [measureValue, setMeasureValue] = useState("");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDelegates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/self-inspect/delegates");
      setItems(res.data?.data ?? []);
    } catch {
      toast.error(t("common.loadError", "조회 중 오류"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDelegates();
  }, [fetchDelegates]);

  const handleSelect = (item: DelegateItem) => {
    setSelected(item);
    setMeasureValue(item.measureValue != null ? String(item.measureValue) : "");
    setRemark(item.remark ?? "");
  };

  const handleSubmit = useCallback(
    async (status: "PASS" | "FAIL") => {
      if (!selected) return;
      setSubmitting(true);
      try {
        await api.patch(`/production/self-inspect/results/${selected.id}/status`, {
          status,
          remark: remark.trim() || undefined,
          measureValue: measureValue !== "" ? Number(measureValue) : undefined,
        });
        toast.success(
          status === "PASS"
            ? t("requestInspect.passSuccess", "합격 처리되었습니다")
            : t("requestInspect.failSuccess", "불합격 처리되었습니다")
        );
        setSelected(null);
        setMeasureValue("");
        setRemark("");
        fetchDelegates();
      } catch {
        toast.error(t("common.saveError", "처리 중 오류"));
      } finally {
        setSubmitting(false);
      }
    },
    [selected, remark, measureValue, t, fetchDelegates]
  );

  const columns: ColumnDef<DelegateItem>[] = [
    { accessorKey: "orderNo", header: t("requestInspect.orderNo", "작업지시"), size: 140 },
    { accessorKey: "processCode", header: t("requestInspect.processCode", "공정"), size: 90 },
    { accessorKey: "itemName", header: t("requestInspect.itemName", "항목명"), size: 180 },
    {
      accessorKey: "timing",
      header: t("requestInspect.timing", "시점"),
      size: 60,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST" ? "초물" : v === "MID" ? "중물" : "종물";
      },
    },
    {
      accessorKey: "createdAt",
      header: t("requestInspect.requestedAt", "요청일시"),
      size: 140,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(v).toLocaleString("ko-KR") : "-";
      },
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            {t("requestInspect.title", "의뢰검사 입력")}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {t("requestInspect.subtitle", "의뢰검사 대기 항목의 결과를 입력합니다")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchDelegates}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 min-h-0 flex-1">
        {/* 좌측: 대기 목록 */}
        <div className="col-span-5 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-3">
              <p className="text-xs font-semibold text-text-muted mb-2 shrink-0">
                {t("requestInspect.pendingList", "의뢰검사 대기 목록")} ({items.length})
              </p>
              <div className="flex-1 min-h-0">
                <DataGrid
                  data={items}
                  columns={columns}
                  loading={loading}
                  selectedRow={selected}
                  onRowClick={handleSelect}
                  rowKey="id"
                  className="h-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 우측: 결과 입력 */}
        <div className="col-span-7 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col p-5 gap-4">
              {!selected ? (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  {t("requestInspect.selectHint", "좌측에서 항목을 선택하세요")}
                </div>
              ) : (
                <>
                  {/* 항목 정보 */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-text">
                      {selected.itemName}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-text-muted">{t("requestInspect.orderNo", "작업지시")}: </span>
                        <span className="text-text font-mono">{selected.orderNo}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">{t("requestInspect.timing", "시점")}: </span>
                        <span className="text-text">
                          {selected.timing === "FIRST" ? "초물" : selected.timing === "MID" ? "중물" : "종물"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 측정값 입력 */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">
                      {t("requestInspect.measureValue", "측정값")}
                    </label>
                    <input
                      type="number"
                      value={measureValue}
                      onChange={(e) => setMeasureValue(e.target.value)}
                      placeholder={t("requestInspect.measureValuePlaceholder", "측정값 입력 (선택)")}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* 비고 */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">
                      {t("requestInspect.remark", "비고")}
                    </label>
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder={t("requestInspect.remarkPlaceholder", "특이사항 입력 (선택)")}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  {/* 판정 버튼 */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSubmit("PASS")}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {t("requestInspect.pass", "합격 (PASS)")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit("FAIL")}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                      {t("requestInspect.fail", "불합격 (FAIL)")}
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/(authenticated)/quality/request-inspect/
git commit -m "feat: add request-inspect page for delegate inspection input"
```

---

## Task 6: Frontend — `/quality/self-inspect-history` 페이지 (자주검사 이력)

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/self-inspect-history/page.tsx`

### 화면 구조

- **상단**: 필터 영역 (기간, 작업지시번호, 공정코드)
- **좌측 패널 (col-span-5)**: 이력 목록 (`GET /production/self-inspect/history`)
  - 컬럼: 작업지시번호, 공정코드, 검사시점, 판정결과(PASS/FAIL/PENDING), 등록일시
- **우측 패널 (col-span-7)**: 선택된 결과 상세
  - 표시: 항목명, 검사방법, 측정값, 판정, 비고

- [ ] **Step 1: 페이지 파일 작성**

`apps/frontend/src/app/(authenticated)/quality/self-inspect-history/page.tsx`:

```typescript
"use client";

/**
 * @file src/app/(authenticated)/quality/self-inspect-history/page.tsx
 * @description 자주검사 이력 조회 페이지
 *
 * 초보자 가이드:
 * 1. 상단 필터로 기간/작업지시/공정 검색
 * 2. 좌측 목록에서 행 선택 → 우측에 상세 표시
 * 3. 상세에서 orderNo 기준 전체 결과 목록 표시
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { History, RefreshCw, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, CardContent, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface HistoryRecord {
  id: string;
  orderNo: string;
  processCode: string | null;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  measureValue: number | null;
  remark: string | null;
  sampleNo: number;
  inspectedAt: string | null;
  createdAt: string;
}

interface DetailRecord {
  id: string;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  measureValue: number | null;
  remark: string | null;
  sampleNo: number;
  inspectedAt: string | null;
}

export default function SelfInspectHistoryPage() {
  const { t } = useTranslation();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<HistoryRecord | null>(null);
  const [detail, setDetail] = useState<DetailRecord[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [processCode, setProcessCode] = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/self-inspect/history", {
        params: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          orderNo: orderNo || undefined,
          processCode: processCode || undefined,
          limit: 200,
        },
      });
      setRecords(res.data?.data ?? []);
      setSelected(null);
      setDetail([]);
    } catch {
      toast.error(t("common.loadError", "조회 중 오류"));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, orderNo, processCode, t]);

  const handleSelect = useCallback(async (record: HistoryRecord) => {
    setSelected(record);
    try {
      const res = await api.get(`/production/self-inspect/results/${record.orderNo}`);
      setDetail(res.data?.data ?? []);
    } catch {
      setDetail([]);
    }
  }, []);

  const statusBadge = (status: string) => {
    if (status === "PASS")
      return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">PASS</span>;
    if (status === "FAIL")
      return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">FAIL</span>;
    return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">PENDING</span>;
  };

  const columns: ColumnDef<HistoryRecord>[] = [
    { accessorKey: "orderNo", header: t("selfInspectHistory.orderNo", "작업지시"), size: 140 },
    { accessorKey: "processCode", header: t("selfInspectHistory.processCode", "공정"), size: 90 },
    { accessorKey: "itemName", header: t("selfInspectHistory.itemName", "항목명"), size: 160 },
    {
      accessorKey: "timing",
      header: t("selfInspectHistory.timing", "시점"),
      size: 60,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST" ? "초물" : v === "MID" ? "중물" : "종물";
      },
    },
    {
      accessorKey: "status",
      header: t("selfInspectHistory.status", "결과"),
      size: 70,
      cell: ({ getValue }) => statusBadge(getValue<string>()),
    },
    {
      accessorKey: "createdAt",
      header: t("selfInspectHistory.createdAt", "등록일시"),
      size: 130,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(v).toLocaleString("ko-KR") : "-";
      },
    },
  ];

  const detailColumns: ColumnDef<DetailRecord>[] = [
    { accessorKey: "itemName", header: "항목명", size: 160 },
    {
      accessorKey: "timing",
      header: "시점",
      size: 55,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST" ? "초물" : v === "MID" ? "중물" : "종물";
      },
    },
    { accessorKey: "sampleNo", header: "시료번호", size: 65 },
    {
      accessorKey: "measureValue",
      header: "측정값",
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v != null ? v : "-";
      },
    },
    {
      accessorKey: "status",
      header: "결과",
      size: 70,
      cell: ({ getValue }) => statusBadge(getValue<string>()),
    },
    { accessorKey: "remark", header: "비고", size: 150 },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            {t("selfInspectHistory.title", "자주검사 이력")}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {t("selfInspectHistory.subtitle", "자주검사 결과 이력을 조회합니다")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchHistory}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 필터 영역 */}
      <div className="flex gap-2 flex-shrink-0 flex-wrap">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40 text-sm"
          placeholder={t("common.dateFrom", "시작일")}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40 text-sm"
          placeholder={t("common.dateTo", "종료일")}
        />
        <Input
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder={t("selfInspectHistory.orderNo", "작업지시번호")}
          className="w-44 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") fetchHistory(); }}
        />
        <Input
          value={processCode}
          onChange={(e) => setProcessCode(e.target.value)}
          placeholder={t("selfInspectHistory.processCode", "공정코드")}
          className="w-36 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") fetchHistory(); }}
        />
        <Button size="sm" onClick={fetchHistory}>
          <Search className="w-4 h-4 mr-1" />
          {t("common.search")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 min-h-0 flex-1">
        {/* 좌측: 이력 목록 */}
        <div className="col-span-5 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-3">
              <p className="text-xs font-semibold text-text-muted mb-2 shrink-0">
                {t("selfInspectHistory.resultList", "검사 이력")} ({records.length})
              </p>
              <div className="flex-1 min-h-0">
                <DataGrid
                  data={records}
                  columns={columns}
                  loading={loading}
                  selectedRow={selected}
                  onRowClick={handleSelect}
                  rowKey="id"
                  className="h-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 우측: 상세 */}
        <div className="col-span-7 flex flex-col min-h-0">
          <Card padding="none" className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col min-h-0 p-4 gap-3">
              {!selected ? (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">
                  {t("selfInspectHistory.selectHint", "좌측에서 이력을 선택하세요")}
                </div>
              ) : (
                <>
                  <div className="shrink-0">
                    <p className="text-xs text-text-muted">
                      {t("selfInspectHistory.orderNo", "작업지시")}: <span className="font-mono text-text">{selected.orderNo}</span>
                    </p>
                  </div>
                  <div className="flex-1 min-h-0">
                    <DataGrid
                      data={detail}
                      columns={detailColumns}
                      rowKey="id"
                      className="h-full"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/app/(authenticated)/quality/self-inspect-history/
git commit -m "feat: add self-inspect history page"
```

---

## Task 7: 메뉴 등록 + i18n 4파일 업데이트 + 최종 빌드 검증

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: menuConfig.ts에 2개 메뉴 추가**

`apps/frontend/src/config/menuConfig.ts` 의 QUALITY 그룹 children 배열에서
`{ code: "QC_INSPECT", ... }` 라인 바로 아래에 추가:

```typescript
      { code: "QC_REQUEST_INSPECT", labelKey: "menu.quality.requestInspect", path: "/quality/request-inspect" },
      { code: "QC_SELF_INSPECT_HISTORY", labelKey: "menu.quality.selfInspectHistory", path: "/quality/self-inspect-history" },
```

- [ ] **Step 2: ko.json i18n 키 추가**

`apps/frontend/src/locales/ko.json` 에서 `"menu"` → `"quality"` 블록에:
```json
"requestInspect": "의뢰검사 입력",
"selfInspectHistory": "자주검사 이력"
```

그리고 최상위에 다음 키 블록을 추가:
```json
"requestInspect": {
  "title": "의뢰검사 입력",
  "subtitle": "의뢰검사 대기 항목의 결과를 입력합니다",
  "pendingList": "의뢰검사 대기 목록",
  "orderNo": "작업지시",
  "processCode": "공정",
  "itemName": "항목명",
  "timing": "시점",
  "requestedAt": "요청일시",
  "selectHint": "좌측에서 항목을 선택하세요",
  "measureValue": "측정값",
  "measureValuePlaceholder": "측정값 입력 (선택)",
  "remark": "비고",
  "remarkPlaceholder": "특이사항 입력 (선택)",
  "pass": "합격 (PASS)",
  "fail": "불합격 (FAIL)",
  "passSuccess": "합격 처리되었습니다",
  "failSuccess": "불합격 처리되었습니다"
},
"selfInspectHistory": {
  "title": "자주검사 이력",
  "subtitle": "자주검사 결과 이력을 조회합니다",
  "resultList": "검사 이력",
  "orderNo": "작업지시번호",
  "processCode": "공정코드",
  "itemName": "항목명",
  "timing": "시점",
  "status": "결과",
  "createdAt": "등록일시",
  "selectHint": "좌측에서 이력을 선택하세요"
},
"selfInspect": {
  "addItem": "항목 추가",
  "itemName": "항목명",
  "itemNameRequired": "항목명을 입력하세요",
  "standard": "기준/규격 (선택)",
  "noItems": "등록된 자주검사 항목이 없습니다"
}
```

그리고 `"master"` → `"routing"` 블록에:
```json
"selfInspectEditorTitle": "자주검사 설정"
```

- [ ] **Step 3: en.json에 동일 키 추가 (영문)**

`apps/frontend/src/locales/en.json` 에 동일 구조로 추가:

`menu.quality` 블록에:
```json
"requestInspect": "Delegate Inspection",
"selfInspectHistory": "Self-Inspect History"
```

최상위 블록:
```json
"requestInspect": {
  "title": "Delegate Inspection",
  "subtitle": "Enter results for pending delegate inspection items",
  "pendingList": "Pending Delegate List",
  "orderNo": "Work Order",
  "processCode": "Process",
  "itemName": "Item Name",
  "timing": "Timing",
  "requestedAt": "Requested At",
  "selectHint": "Select an item on the left",
  "measureValue": "Measured Value",
  "measureValuePlaceholder": "Enter measured value (optional)",
  "remark": "Remark",
  "remarkPlaceholder": "Enter remarks (optional)",
  "pass": "Pass (PASS)",
  "fail": "Fail (FAIL)",
  "passSuccess": "Marked as PASS",
  "failSuccess": "Marked as FAIL"
},
"selfInspectHistory": {
  "title": "Self-Inspect History",
  "subtitle": "View self-inspection result history",
  "resultList": "Inspection History",
  "orderNo": "Work Order No.",
  "processCode": "Process Code",
  "itemName": "Item Name",
  "timing": "Timing",
  "status": "Result",
  "createdAt": "Created At",
  "selectHint": "Select a record on the left"
},
"selfInspect": {
  "addItem": "Add Item",
  "itemName": "Item Name",
  "itemNameRequired": "Item name is required",
  "standard": "Standard (optional)",
  "noItems": "No self-inspection items registered"
}
```

`master.routing` 블록에:
```json
"selfInspectEditorTitle": "Self-Inspect Config"
```

- [ ] **Step 4: zh.json에 동일 키 추가 (중문)**

`apps/frontend/src/locales/zh.json` 에 동일 구조로 추가:

`menu.quality` 블록에:
```json
"requestInspect": "委托检查录入",
"selfInspectHistory": "自检历史"
```

최상위 블록:
```json
"requestInspect": {
  "title": "委托检查录入",
  "subtitle": "输入委托检查待处理项目的结果",
  "pendingList": "委托检查待处理列表",
  "orderNo": "工单",
  "processCode": "工序",
  "itemName": "项目名称",
  "timing": "时点",
  "requestedAt": "请求时间",
  "selectHint": "请在左侧选择项目",
  "measureValue": "测量值",
  "measureValuePlaceholder": "输入测量值（可选）",
  "remark": "备注",
  "remarkPlaceholder": "输入特殊情况（可选）",
  "pass": "合格 (PASS)",
  "fail": "不合格 (FAIL)",
  "passSuccess": "已标记为合格",
  "failSuccess": "已标记为不合格"
},
"selfInspectHistory": {
  "title": "自检历史",
  "subtitle": "查看自检结果历史记录",
  "resultList": "检查历史",
  "orderNo": "工单号",
  "processCode": "工序代码",
  "itemName": "项目名称",
  "timing": "时点",
  "status": "结果",
  "createdAt": "创建时间",
  "selectHint": "请在左侧选择记录"
},
"selfInspect": {
  "addItem": "添加项目",
  "itemName": "项目名称",
  "itemNameRequired": "请输入项目名称",
  "standard": "标准/规格（可选）",
  "noItems": "暂无自检项目"
}
```

`master.routing` 블록에:
```json
"selfInspectEditorTitle": "自检设置"
```

- [ ] **Step 5: vi.json에 동일 키 추가 (베트남어)**

`apps/frontend/src/locales/vi.json` 에 동일 구조로 추가:

`menu.quality` 블록에:
```json
"requestInspect": "Nhập kiểm tra ủy thác",
"selfInspectHistory": "Lịch sử tự kiểm"
```

최상위 블록:
```json
"requestInspect": {
  "title": "Nhập kiểm tra ủy thác",
  "subtitle": "Nhập kết quả cho các hạng mục kiểm tra ủy thác đang chờ",
  "pendingList": "Danh sách chờ kiểm tra ủy thác",
  "orderNo": "Lệnh làm việc",
  "processCode": "Quy trình",
  "itemName": "Tên hạng mục",
  "timing": "Thời điểm",
  "requestedAt": "Thời gian yêu cầu",
  "selectHint": "Chọn hạng mục ở bên trái",
  "measureValue": "Giá trị đo",
  "measureValuePlaceholder": "Nhập giá trị đo (tùy chọn)",
  "remark": "Ghi chú",
  "remarkPlaceholder": "Nhập ghi chú (tùy chọn)",
  "pass": "Đạt (PASS)",
  "fail": "Không đạt (FAIL)",
  "passSuccess": "Đã đánh dấu đạt",
  "failSuccess": "Đã đánh dấu không đạt"
},
"selfInspectHistory": {
  "title": "Lịch sử tự kiểm",
  "subtitle": "Xem lịch sử kết quả tự kiểm",
  "resultList": "Lịch sử kiểm tra",
  "orderNo": "Số lệnh làm việc",
  "processCode": "Mã quy trình",
  "itemName": "Tên hạng mục",
  "timing": "Thời điểm",
  "status": "Kết quả",
  "createdAt": "Ngày tạo",
  "selectHint": "Chọn bản ghi ở bên trái"
},
"selfInspect": {
  "addItem": "Thêm hạng mục",
  "itemName": "Tên hạng mục",
  "itemNameRequired": "Vui lòng nhập tên hạng mục",
  "standard": "Tiêu chuẩn (tùy chọn)",
  "noItems": "Chưa có hạng mục tự kiểm nào"
}
```

`master.routing` 블록에:
```json
"selfInspectEditorTitle": "Cấu hình tự kiểm"
```

- [ ] **Step 6: i18n 키 누락 여부 확인 (Grep)**

```bash
grep -c '"requestInspect"' /c/Project/HANES/apps/frontend/src/locales/ko.json
grep -c '"requestInspect"' /c/Project/HANES/apps/frontend/src/locales/en.json
grep -c '"requestInspect"' /c/Project/HANES/apps/frontend/src/locales/zh.json
grep -c '"requestInspect"' /c/Project/HANES/apps/frontend/src/locales/vi.json
```

Expected: 각 파일에서 1 이상 출력

- [ ] **Step 7: 최종 pnpm build 검증**

```bash
cd C:/Project/HANES && pnpm build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` (또는 에러 0건)

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/config/menuConfig.ts \
        apps/frontend/src/locales/ko.json \
        apps/frontend/src/locales/en.json \
        apps/frontend/src/locales/zh.json \
        apps/frontend/src/locales/vi.json
git commit -m "feat: add menu entries and i18n for request-inspect and self-inspect-history"
```

---

## 검증 기준

1. `pnpm build` 에러 0건
2. 라우팅 페이지(`/master/routing`) 우측 패널에 "자주검사 설정" 탭 표시
3. 탭에서 공정 선택 시 `GET /production/self-inspect/items/all` 호출 → 항목 목록 표시
4. 항목 추가/수정/삭제가 올바르게 동작 (DB 저장 확인)
5. `/quality/request-inspect` 에서 의뢰검사 대기 목록 조회 및 PASS/FAIL 처리
6. `/quality/self-inspect-history` 에서 이력 조회 및 상세 표시
7. QUALITY 메뉴 그룹에 "의뢰검사 입력", "자주검사 이력" 메뉴 항목 표시
8. ko/en/zh/vi 4개 언어 전환 시 번역 키 누락 없음
