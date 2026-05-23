# IQC 검사 기준 관리 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IQC 검사항목 관리를 "전역 검사항목 마스터(풀) + 품목별 IQC 기준(시료수/파괴검사여부/개별 검사항목+LSL/USL)" 구조로 재설계한다.

**Architecture:** 기존 IQC_ITEM_POOL은 유지하면서 신규 테이블 2개(IQC_PART_SPECS, IQC_PART_SPEC_ITEMS)를 추가해 품목별 독립 기준을 관리한다. 프론트엔드는 기존 3탭을 2탭(검사항목 마스터 / 품목별 IQC 기준)으로 개편한다.

**Tech Stack:** NestJS/TypeORM (Oracle), Next.js 14, TanStack Table DataGrid, pnpm

---

## 파일 구조

### 신규 생성
- `apps/backend/src/entities/iqc-part-spec.entity.ts` — 품목별 IQC 헤더 엔티티
- `apps/backend/src/entities/iqc-part-spec-item.entity.ts` — 품목별 검사항목 엔티티
- `apps/backend/src/modules/master/dto/iqc-part-spec.dto.ts` — DTO
- `apps/backend/src/modules/master/services/iqc-part-spec.service.ts` — 서비스
- `apps/backend/src/modules/master/controllers/iqc-part-spec.controller.ts` — 컨트롤러
- `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx` — 우측 기준 설정 패널

### 수정
- `apps/backend/src/modules/master/master.module.ts` — 신규 엔티티/서비스/컨트롤러 등록
- `apps/frontend/src/app/(authenticated)/master/iqc-item/page.tsx` — 탭 구조 개편
- `apps/frontend/src/app/(authenticated)/master/iqc-item/types.ts` — 신규 타입 추가
- `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcItemTab.tsx` — LSL/USL/리비전 컬럼 제거, 단순화

---

## Task 1: Oracle DDL — 신규 테이블 2개 생성

**Files:**
- Oracle DB (JSHANES 사이트)

- [ ] **Step 1: oracle-db 스킬로 DDL 실행**

`/oracle-db` 스킬을 사용해 아래 DDL을 JSHANES 사이트에 실행한다.

```sql
-- 품목별 IQC 기준 헤더
CREATE TABLE IQC_PART_SPECS (
  COMPANY      VARCHAR2(50)  NOT NULL,
  PLANT_CD     VARCHAR2(50)  NOT NULL,
  ITEM_CODE    VARCHAR2(50)  NOT NULL,
  SAMPLE_QTY   NUMBER(5)     DEFAULT 1 NOT NULL,
  IS_DEST      VARCHAR2(1)   DEFAULT 'N' NOT NULL,
  USE_YN       VARCHAR2(1)   DEFAULT 'Y' NOT NULL,
  CREATED_BY   VARCHAR2(50),
  UPDATED_BY   VARCHAR2(50),
  CREATED_AT   TIMESTAMP     DEFAULT SYSTIMESTAMP,
  UPDATED_AT   TIMESTAMP     DEFAULT SYSTIMESTAMP,
  CONSTRAINT PK_IQC_PART_SPECS PRIMARY KEY (COMPANY, PLANT_CD, ITEM_CODE)
);

COMMENT ON TABLE  IQC_PART_SPECS              IS '품목별 IQC 기준 헤더';
COMMENT ON COLUMN IQC_PART_SPECS.COMPANY      IS '회사코드 (PK)';
COMMENT ON COLUMN IQC_PART_SPECS.PLANT_CD     IS '공장코드 (PK)';
COMMENT ON COLUMN IQC_PART_SPECS.ITEM_CODE    IS '품목코드 (PK)';
COMMENT ON COLUMN IQC_PART_SPECS.SAMPLE_QTY   IS '기본 시료수 (IQC 실적 입력 시 기본값)';
COMMENT ON COLUMN IQC_PART_SPECS.IS_DEST      IS '파괴검사 여부 Y/N';
COMMENT ON COLUMN IQC_PART_SPECS.USE_YN       IS '사용여부 Y/N';

-- 품목별 IQC 검사항목 세부
CREATE TABLE IQC_PART_SPEC_ITEMS (
  COMPANY         VARCHAR2(50)  NOT NULL,
  PLANT_CD        VARCHAR2(50)  NOT NULL,
  ITEM_CODE       VARCHAR2(50)  NOT NULL,
  SEQ             NUMBER(5)     NOT NULL,
  INSP_ITEM_CODE  VARCHAR2(20)  NOT NULL,
  LSL             NUMBER(12,4),
  USL             NUMBER(12,4),
  USE_YN          VARCHAR2(1)   DEFAULT 'Y' NOT NULL,
  CREATED_BY      VARCHAR2(50),
  UPDATED_BY      VARCHAR2(50),
  CREATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
  UPDATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
  CONSTRAINT PK_IQC_PART_SPEC_ITEMS PRIMARY KEY (COMPANY, PLANT_CD, ITEM_CODE, SEQ),
  CONSTRAINT FK_SPEC_ITEMS_INSP  FOREIGN KEY (COMPANY, PLANT_CD, INSP_ITEM_CODE)
    REFERENCES IQC_ITEM_POOL(COMPANY, PLANT_CD, INSP_ITEM_CODE),
  CONSTRAINT FK_SPEC_ITEMS_SPEC  FOREIGN KEY (COMPANY, PLANT_CD, ITEM_CODE)
    REFERENCES IQC_PART_SPECS(COMPANY, PLANT_CD, ITEM_CODE) ON DELETE CASCADE
);

COMMENT ON TABLE  IQC_PART_SPEC_ITEMS                 IS '품목별 IQC 검사항목 세부';
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.COMPANY          IS '회사코드 (PK/FK → IQC_PART_SPECS)';
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.PLANT_CD         IS '공장코드 (PK/FK → IQC_PART_SPECS)';
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.ITEM_CODE        IS '품목코드 (PK/FK → IQC_PART_SPECS)';
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.SEQ              IS '검사 순서';
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.INSP_ITEM_CODE   IS '검사항목코드 (FK → IQC_ITEM_POOL)';
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.LSL              IS '하한 규격값 (측정형에만 사용)';
COMMENT ON COLUMN IQC_PART_SPEC_ITEMS.USL              IS '상한 규격값 (측정형에만 사용)';
```

- [ ] **Step 2: 테이블 생성 확인**

```sql
SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME IN ('IQC_PART_SPECS', 'IQC_PART_SPEC_ITEMS');
```

Expected: 두 테이블이 조회됨.

---

## Task 2: 백엔드 엔티티 생성

**Files:**
- Create: `apps/backend/src/entities/iqc-part-spec.entity.ts`
- Create: `apps/backend/src/entities/iqc-part-spec-item.entity.ts`

- [ ] **Step 1: IqcPartSpec 엔티티 작성**

```typescript
// apps/backend/src/entities/iqc-part-spec.entity.ts
/**
 * @file iqc-part-spec.entity.ts
 * @description 품목별 IQC 기준 헤더 엔티티
 *              COMPANY + PLANT_CD + ITEM_CODE 복합키. 시료수·파괴검사여부 보유.
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { IqcPartSpecItem } from './iqc-part-spec-item.entity';

@Entity({ name: 'IQC_PART_SPECS' })
export class IqcPartSpec {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'SAMPLE_QTY', type: 'int', default: 1 })
  sampleQty: number;

  @Column({ name: 'IS_DEST', length: 1, default: 'N' })
  isDest: string;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => IqcPartSpecItem, (i) => i.spec, { cascade: true })
  items: IqcPartSpecItem[];
}
```

- [ ] **Step 2: IqcPartSpecItem 엔티티 작성**

```typescript
// apps/backend/src/entities/iqc-part-spec-item.entity.ts
/**
 * @file iqc-part-spec-item.entity.ts
 * @description 품목별 IQC 검사항목 세부 엔티티
 *              COMPANY + PLANT_CD + ITEM_CODE + SEQ 복합 PK. IQC_ITEM_POOL 참조 + 개별 LSL/USL.
 */
import {
  Entity, PrimaryColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { IqcPartSpec } from './iqc-part-spec.entity';
import { IqcItemPool } from './iqc-item-pool.entity';

@Entity({ name: 'IQC_PART_SPEC_ITEMS' })
export class IqcPartSpecItem {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'INSP_ITEM_CODE', length: 20 })
  inspItemCode: string;

  @Column({ name: 'LSL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  lsl: number | null;

  @Column({ name: 'USL', type: 'decimal', precision: 12, scale: 4, nullable: true })
  usl: number | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => IqcPartSpec, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'ITEM_CODE', referencedColumnName: 'itemCode' },
  ])
  spec: IqcPartSpec;

  @ManyToOne(() => IqcItemPool, { eager: true })
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plant' },
    { name: 'INSP_ITEM_CODE', referencedColumnName: 'inspItemCode' },
  ])
  inspItem: IqcItemPool;
}
```

---

## Task 3: 백엔드 DTO 생성

**Files:**
- Create: `apps/backend/src/modules/master/dto/iqc-part-spec.dto.ts`

- [ ] **Step 1: DTO 작성**

```typescript
// apps/backend/src/modules/master/dto/iqc-part-spec.dto.ts
/**
 * @file iqc-part-spec.dto.ts
 * @description 품목별 IQC 기준 DTO
 */
import {
  IsString, IsNumber, IsOptional, IsArray,
  ValidateNested, IsIn, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IqcPartSpecItemDto {
  @IsNumber()
  seq: number;

  @IsString()
  inspItemCode: string;

  @IsOptional()
  @IsNumber()
  lsl?: number | null;

  @IsOptional()
  @IsNumber()
  usl?: number | null;

  @IsOptional()
  @IsString()
  useYn?: string;
}

export class UpsertIqcPartSpecDto {
  @IsString()
  itemCode: string;

  @IsNumber()
  @Min(1)
  sampleQty: number;

  @IsIn(['Y', 'N'])
  isDest: string;

  @IsOptional()
  @IsString()
  useYn?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IqcPartSpecItemDto)
  items: IqcPartSpecItemDto[];
}

export class IqcPartSpecQueryDto {
  @IsOptional()
  @IsString()
  itemCode?: string;
}
```

---

## Task 4: 백엔드 서비스 구현

**Files:**
- Create: `apps/backend/src/modules/master/services/iqc-part-spec.service.ts`

- [ ] **Step 1: 서비스 작성**

```typescript
// apps/backend/src/modules/master/services/iqc-part-spec.service.ts
/**
 * @file iqc-part-spec.service.ts
 * @description 품목별 IQC 기준 CRUD 서비스
 *
 * 초보자 가이드:
 * 1. findByItemCode: 품목코드로 헤더+검사항목 조회
 * 2. upsert: 헤더 없으면 INSERT, 있으면 UPDATE + 검사항목 전체 교체
 * 3. delete: 헤더 삭제 (CASCADE로 세부항목 자동 삭제)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IqcPartSpec } from '../../../entities/iqc-part-spec.entity';
import { IqcPartSpecItem } from '../../../entities/iqc-part-spec-item.entity';
import { UpsertIqcPartSpecDto } from '../dto/iqc-part-spec.dto';

@Injectable()
export class IqcPartSpecService {
  constructor(
    @InjectRepository(IqcPartSpec)
    private readonly specRepo: Repository<IqcPartSpec>,
    @InjectRepository(IqcPartSpecItem)
    private readonly itemRepo: Repository<IqcPartSpecItem>,
    private readonly dataSource: DataSource,
  ) {}

  async findByItemCode(itemCode: string): Promise<IqcPartSpec | null> {
    return this.specRepo.findOne({
      where: { itemCode },
      relations: ['items', 'items.inspItem'],
      order: { items: { seq: 'ASC' } },
    });
  }

  async findAll(company?: string, plant?: string): Promise<IqcPartSpec[]> {
    const qb = this.specRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.items', 'i')
      .leftJoinAndSelect('i.inspItem', 'p')
      .orderBy('s.itemCode', 'ASC')
      .addOrderBy('i.seq', 'ASC');

    if (company) qb.andWhere('s.company = :company', { company });
    if (plant)   qb.andWhere('s.plant = :plant', { plant });

    return qb.getMany();
  }

  async upsert(
    dto: UpsertIqcPartSpecDto,
    company: string,
    plant: string,
    userId: string,
  ): Promise<IqcPartSpec> {
    return this.dataSource.transaction(async (em) => {
      let spec = await em.findOne(IqcPartSpec, { where: { itemCode: dto.itemCode } });

      if (!spec) {
        spec = em.create(IqcPartSpec, {
          itemCode: dto.itemCode,
          sampleQty: dto.sampleQty,
          isDest: dto.isDest,
          useYn: dto.useYn ?? 'Y',
          company,
          plant,
          createdBy: userId,
          updatedBy: userId,
        });
      } else {
        spec.sampleQty = dto.sampleQty;
        spec.isDest = dto.isDest;
        spec.useYn = dto.useYn ?? spec.useYn;
        spec.updatedBy = userId;
      }
      await em.save(IqcPartSpec, spec);

      // 기존 검사항목 전체 삭제 후 재삽입
      await em.delete(IqcPartSpecItem, { itemCode: dto.itemCode });

      if (dto.items.length > 0) {
        const newItems = dto.items.map((it) =>
          em.create(IqcPartSpecItem, {
            itemCode: dto.itemCode,
            seq: it.seq,
            inspItemCode: it.inspItemCode,
            lsl: it.lsl ?? null,
            usl: it.usl ?? null,
            useYn: it.useYn ?? 'Y',
            company,
            plant,
            createdBy: userId,
            updatedBy: userId,
          }),
        );
        await em.save(IqcPartSpecItem, newItems);
      }

      return em.findOne(IqcPartSpec, {
        where: { itemCode: dto.itemCode },
        relations: ['items', 'items.inspItem'],
        order: { items: { seq: 'ASC' } },
      }) as Promise<IqcPartSpec>;
    });
  }

  async delete(itemCode: string): Promise<void> {
    const spec = await this.specRepo.findOne({ where: { itemCode } });
    if (!spec) throw new NotFoundException(`IQC 기준이 없습니다: ${itemCode}`);
    await this.specRepo.remove(spec);
  }
}
```

---

## Task 5: 백엔드 컨트롤러 구현

**Files:**
- Create: `apps/backend/src/modules/master/controllers/iqc-part-spec.controller.ts`

- [ ] **Step 1: 컨트롤러 작성**

```typescript
// apps/backend/src/modules/master/controllers/iqc-part-spec.controller.ts
/**
 * @file iqc-part-spec.controller.ts
 * @description 품목별 IQC 기준 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET  /master/iqc-part-specs          — 전체 목록 (품목코드 기준)
 * 2. GET  /master/iqc-part-specs/:itemCode — 특정 품목 기준 상세
 * 3. POST /master/iqc-part-specs          — upsert (없으면 생성, 있으면 수정)
 * 4. DELETE /master/iqc-part-specs/:itemCode — 삭제
 */
import {
  Controller, Get, Post, Delete,
  Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  Company, Plant, UserId,
} from '../../../common/decorators/tenant.decorator';
import { IqcPartSpecService } from '../services/iqc-part-spec.service';
import { UpsertIqcPartSpecDto } from '../dto/iqc-part-spec.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 품목별 IQC 기준')
@UseGuards(JwtAuthGuard)
@Controller('master/iqc-part-specs')
export class IqcPartSpecController {
  constructor(private readonly service: IqcPartSpecService) {}

  @Get()
  @ApiOperation({ summary: '품목별 IQC 기준 전체 조회' })
  async findAll(@Company() company: string, @Plant() plant: string) {
    const data = await this.service.findAll(company, plant);
    return ResponseUtil.success(data);
  }

  @Get(':itemCode')
  @ApiOperation({ summary: '품목별 IQC 기준 상세 조회' })
  async findOne(@Param('itemCode') itemCode: string) {
    const data = await this.service.findByItemCode(itemCode);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '품목별 IQC 기준 저장 (upsert)' })
  async upsert(
    @Body() dto: UpsertIqcPartSpecDto,
    @Company() company: string,
    @Plant() plant: string,
    @UserId() userId: string,
  ) {
    const data = await this.service.upsert(dto, company, plant, userId);
    return ResponseUtil.success(data, '저장되었습니다.');
  }

  @Delete(':itemCode')
  @ApiOperation({ summary: '품목별 IQC 기준 삭제' })
  async delete(@Param('itemCode') itemCode: string) {
    await this.service.delete(itemCode);
    return ResponseUtil.success(null, '삭제되었습니다.');
  }
}
```

> **주의:** `UserId` 데코레이터가 존재하는지 확인. 없으면 `@User() user: any` 패턴으로 대체하거나 tenant.decorator.ts에 추가.
> 확인 방법: `grep -r "UserId" apps/backend/src/common/decorators/`

---

## Task 6: master.module.ts 수정

**Files:**
- Modify: `apps/backend/src/modules/master/master.module.ts`

- [ ] **Step 1: import 추가 (파일 상단 import 블록)**

아래 3줄을 기존 import 블록 끝에 추가:

```typescript
import { IqcPartSpec } from '../../entities/iqc-part-spec.entity';
import { IqcPartSpecItem } from '../../entities/iqc-part-spec-item.entity';
import { IqcPartSpecController } from './controllers/iqc-part-spec.controller';
import { IqcPartSpecService } from './services/iqc-part-spec.service';
```

- [ ] **Step 2: TypeOrmModule.forFeature 배열에 엔티티 추가**

`IqcItemPool,` 다음 줄에 추가:

```typescript
IqcPartSpec,
IqcPartSpecItem,
```

- [ ] **Step 3: controllers 배열에 추가**

기존 controllers 배열에 `IqcPartSpecController,` 추가.

- [ ] **Step 4: providers 배열에 추가**

기존 providers 배열에 `IqcPartSpecService,` 추가.

- [ ] **Step 5: 빌드 확인**

```bash
cd /c/Project/HANES && pnpm --filter backend build 2>&1 | tail -20
```

Expected: error 없이 빌드 성공.

---

## Task 7: UserId 데코레이터 확인 및 추가

**Files:**
- Modify: `apps/backend/src/common/decorators/tenant.decorator.ts` (필요 시)

- [ ] **Step 1: 기존 데코레이터 확인**

```bash
grep -n "UserId\|userId\|export.*User" apps/backend/src/common/decorators/tenant.decorator.ts
```

- [ ] **Step 2: UserId가 없으면 추가**

tenant.decorator.ts 에서 User 관련 데코레이터를 확인하고, `UserId`가 없다면:

```typescript
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.userId ?? request.user?.id ?? 'SYSTEM';
  },
);
```

없다면 컨트롤러에서 `@UserId()` 대신 아래 패턴 사용:
```typescript
// 컨트롤러 파라미터 변경
@Post()
async upsert(
  @Body() dto: UpsertIqcPartSpecDto,
  @Company() company: string,
  @Plant() plant: string,
  @Req() req: any,
) {
  const userId = req.user?.userId ?? req.user?.id ?? 'SYSTEM';
  const data = await this.service.upsert(dto, company, plant, userId);
  return ResponseUtil.success(data, '저장되었습니다.');
}
```

---

## Task 8: 프론트엔드 types.ts 타입 추가

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/types.ts`

- [ ] **Step 1: 신규 타입 추가**

기존 파일 끝에 추가:

```typescript
// 검사항목 풀 (전역 마스터)
export interface IqcPoolItem {
  inspItemCode: string;
  inspItemName: string;
  judgeMethod: 'VISUAL' | 'MEASURE';
  unit: string | null;
  useYn: string;
}

// 품목별 IQC 검사항목 행
export interface IqcSpecRow {
  seq: number;
  inspItemCode: string;
  inspItemName?: string;   // inspItem.inspItemName
  judgeMethod?: 'VISUAL' | 'MEASURE';
  unit?: string | null;
  lsl: number | null;
  usl: number | null;
  useYn: string;
}

// 품목별 IQC 기준 전체
export interface IqcPartSpec {
  itemCode: string;
  sampleQty: number;
  isDest: string;  // 'Y' | 'N'
  useYn: string;
  items: IqcSpecRow[];
}
```

---

## Task 9: IqcSpecPanel 컴포넌트 구현

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcSpecPanel.tsx`

- [ ] **Step 1: IqcSpecPanel 작성**

```tsx
"use client";
/**
 * @file components/IqcSpecPanel.tsx
 * @description 품목별 IQC 기준 우측 패널 — 시료수/파괴검사 헤더 + 검사항목 인라인 DataGrid
 *
 * 초보자 가이드:
 * 1. 선택된 품목(itemCode)에 대한 IQC 기준을 표시/편집
 * 2. 헤더: 시료수(number), 파괴검사여부(Y/N 토글)
 * 3. 검사항목 DataGrid: 행 추가/삭제 + 인라인 편집 (검사항목 선택 + LSL/USL)
 * 4. [저장] 한 번에 POST /master/iqc-part-specs
 */
import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button, Card, CardContent, Select } from "@/components/ui";
import type { IqcPoolItem, IqcPartSpec, IqcSpecRow } from "../types";
import api from "@/services/api";

interface Props {
  itemCode: string | null;
  itemName: string;
  poolItems: IqcPoolItem[];
}

const EMPTY_SPEC: IqcPartSpec = {
  itemCode: '',
  sampleQty: 1,
  isDest: 'N',
  useYn: 'Y',
  items: [],
};

export default function IqcSpecPanel({ itemCode, itemName, poolItems }: Props) {
  const [spec, setSpec] = useState<IqcPartSpec>(EMPTY_SPEC);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadSpec = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/master/iqc-part-specs/${encodeURIComponent(code)}`);
      if (res.data?.data) {
        const d = res.data.data;
        setSpec({
          itemCode: d.itemCode,
          sampleQty: d.sampleQty ?? 1,
          isDest: d.isDest ?? 'N',
          useYn: d.useYn ?? 'Y',
          items: (d.items ?? []).map((it: any) => ({
            seq: it.seq,
            inspItemCode: it.inspItemCode,
            inspItemName: it.inspItem?.inspItemName ?? '',
            judgeMethod: it.inspItem?.judgeMethod,
            unit: it.inspItem?.unit ?? null,
            lsl: it.lsl ?? null,
            usl: it.usl ?? null,
            useYn: it.useYn ?? 'Y',
          })),
        });
      } else {
        setSpec({ ...EMPTY_SPEC, itemCode: code });
      }
    } catch {
      setSpec({ ...EMPTY_SPEC, itemCode: code });
    } finally {
      setLoading(false);
      setDirty(false);
    }
  }, []);

  useEffect(() => {
    if (itemCode) {
      loadSpec(itemCode);
    } else {
      setSpec(EMPTY_SPEC);
    }
  }, [itemCode, loadSpec]);

  const updateHeader = (field: keyof IqcPartSpec, value: unknown) => {
    setSpec((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const addRow = () => {
    const maxSeq = spec.items.length > 0
      ? Math.max(...spec.items.map((i) => i.seq))
      : 0;
    setSpec((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { seq: maxSeq + 1, inspItemCode: '', lsl: null, usl: null, useYn: 'Y' },
      ],
    }));
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setSpec((prev) => {
      const newItems = prev.items
        .filter((_, i) => i !== idx)
        .map((it, i) => ({ ...it, seq: i + 1 }));
      return { ...prev, items: newItems };
    });
    setDirty(true);
  };

  const updateRow = (idx: number, field: keyof IqcSpecRow, value: unknown) => {
    setSpec((prev) => {
      const items = [...prev.items];
      if (field === 'inspItemCode') {
        const pool = poolItems.find((p) => p.inspItemCode === value);
        items[idx] = {
          ...items[idx],
          inspItemCode: value as string,
          inspItemName: pool?.inspItemName ?? '',
          judgeMethod: pool?.judgeMethod,
          unit: pool?.unit ?? null,
          lsl: null,
          usl: null,
        };
      } else {
        items[idx] = { ...items[idx], [field]: value };
      }
      return { ...prev, items };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!itemCode) return;
    setSaving(true);
    try {
      await api.post('/master/iqc-part-specs', {
        itemCode,
        sampleQty: spec.sampleQty,
        isDest: spec.isDest,
        useYn: spec.useYn,
        items: spec.items
          .filter((it) => it.inspItemCode)
          .map((it) => ({
            seq: it.seq,
            inspItemCode: it.inspItemCode,
            lsl: it.lsl,
            usl: it.usl,
            useYn: it.useYn,
          })),
      });
      setDirty(false);
      await loadSpec(itemCode);
    } catch (err) {
      console.error('IQC 기준 저장 실패:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!itemCode) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        좌측에서 품목을 선택하세요.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* 헤더 카드 */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="font-semibold text-text min-w-0 truncate max-w-xs">
              {itemName}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-muted whitespace-nowrap">기본 시료수</label>
              <input
                type="number"
                min={1}
                value={spec.sampleQty}
                onChange={(e) => updateHeader('sampleQty', Number(e.target.value))}
                className="w-20 border border-border rounded px-2 py-1 text-sm bg-bg text-text"
              />
              <span className="text-sm text-text-muted">개</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-muted whitespace-nowrap">파괴검사</label>
              <button
                onClick={() => updateHeader('isDest', spec.isDest === 'Y' ? 'N' : 'Y')}
                className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                  spec.isDest === 'Y'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-bg text-text-muted border-border'
                }`}
              >
                {spec.isDest === 'Y' ? '파괴' : '비파괴'}
              </button>
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                {saving ? '저장 중…' : '저장'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 검사항목 DataGrid */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden border border-border rounded-lg bg-bg">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-medium text-text">검사항목</span>
          <Button size="sm" variant="outline" onClick={addRow} className="flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            항목 추가
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            불러오는 중…
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg-elevated border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-text-muted w-12">순서</th>
                  <th className="px-3 py-2 text-left text-text-muted">검사항목</th>
                  <th className="px-3 py-2 text-left text-text-muted w-20">종류</th>
                  <th className="px-3 py-2 text-left text-text-muted w-28">하한(LSL)</th>
                  <th className="px-3 py-2 text-left text-text-muted w-28">상한(USL)</th>
                  <th className="px-3 py-2 text-left text-text-muted w-16">단위</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {spec.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">
                      검사항목이 없습니다. [항목 추가]를 눌러 추가하세요.
                    </td>
                  </tr>
                )}
                {spec.items.map((row, idx) => {
                  const isMeasure = row.judgeMethod === 'MEASURE';
                  return (
                    <tr key={idx} className="border-b border-border hover:bg-bg-elevated transition-colors">
                      <td className="px-3 py-1.5 text-text-muted text-center">{row.seq}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={row.inspItemCode}
                          onChange={(e) => updateRow(idx, 'inspItemCode', e.target.value)}
                          className="w-full border border-border rounded px-2 py-1 bg-bg text-text text-sm"
                        >
                          <option value="">-- 선택 --</option>
                          {poolItems.filter((p) => p.useYn === 'Y').map((p) => (
                            <option key={p.inspItemCode} value={p.inspItemCode}>
                              {p.inspItemCode} {p.inspItemName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          row.judgeMethod === 'MEASURE'
                            ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {row.judgeMethod === 'MEASURE' ? '측정형' : row.judgeMethod === 'VISUAL' ? '판정형' : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        {isMeasure ? (
                          <input
                            type="number"
                            value={row.lsl ?? ''}
                            onChange={(e) => updateRow(idx, 'lsl', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full border border-border rounded px-2 py-1 text-sm bg-bg text-text"
                          />
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {isMeasure ? (
                          <input
                            type="number"
                            value={row.usl ?? ''}
                            onChange={(e) => updateRow(idx, 'usl', e.target.value === '' ? null : Number(e.target.value))}
                            className="w-full border border-border rounded px-2 py-1 text-sm bg-bg text-text"
                          />
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-text-muted text-xs">
                        {row.unit ?? '-'}
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => removeRow(idx)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Task 10: page.tsx 탭 구조 개편

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/page.tsx`

- [ ] **Step 1: page.tsx 전체 재작성**

기존 page.tsx를 아래로 교체한다. (기존 3탭 → 2탭: 검사항목 마스터 / 품목별 IQC 기준)

```tsx
"use client";

/**
 * @file src/app/(authenticated)/master/iqc-item/page.tsx
 * @description IQC 검사 관리 통합 페이지 (2탭)
 *
 * 초보자 가이드:
 * 1. [검사항목 마스터] 탭: 전역 검사항목 코드/명/종류/단위 CRUD
 * 2. [품목별 IQC 기준] 탭: 품목 선택 → 시료수/파괴검사/검사항목+규격 설정
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck } from "lucide-react";
import IqcItemTab from "./components/IqcItemTab";
import ItemListPanel from "./components/ItemListPanel";
import IqcSpecPanel from "./components/IqcSpecPanel";
import type { IqcPoolItem } from "./types";
import api from "@/services/api";

type TabValue = "items" | "perItem";

interface PartItem {
  itemCode: string;
  itemName: string;
}

export default function IqcItemPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>("items");

  /* 품목별 탭 상태 */
  const [parts, setParts] = useState<PartItem[]>([]);
  const [specCountMap, setSpecCountMap] = useState<Map<string, number>>(new Map());
  const [poolItems, setPoolItems] = useState<IqcPoolItem[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const fetchBase = useCallback(async () => {
    setPartsLoading(true);
    try {
      const [partsRes, specsRes, poolRes] = await Promise.all([
        api.get("/master/parts", { params: { itemType: "RAW_MATERIAL", limit: "5000" } }),
        api.get("/master/iqc-part-specs"),
        api.get("/master/iqc-item-pool", { params: { limit: "5000", useYn: "Y" } }),
      ]);
      setParts(partsRes.data?.data ?? []);

      const specs: { itemCode: string; items: unknown[] }[] = specsRes.data?.data ?? [];
      const m = new Map<string, number>();
      specs.forEach((s) => m.set(s.itemCode, s.items?.length ?? 0));
      setSpecCountMap(m);

      setPoolItems(
        (poolRes.data?.data ?? []).map((p: any) => ({
          inspItemCode: p.inspItemCode,
          inspItemName: p.inspItemName,
          judgeMethod: p.judgeMethod,
          unit: p.unit ?? null,
          useYn: p.useYn,
        }))
      );
    } catch {
      setParts([]);
    } finally {
      setPartsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBase();
  }, [fetchBase]);

  const selectedItemName = useMemo(
    () => parts.find((p) => p.itemCode === selectedItemCode)?.itemName ?? "",
    [parts, selectedItemCode]
  );

  const tabs: { key: TabValue; label: string }[] = [
    { key: "items", label: t("master.iqcItem.itemPool", "검사항목 마스터") },
    { key: "perItem", label: t("master.iqcItem.perItemIqc", "품목별 IQC 기준") },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-primary" />
          {t("master.iqcItem.title")}
        </h1>
        <p className="text-text-muted mt-1">{t("master.iqcItem.subtitle")}</p>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`h-full ${activeTab === "items" ? "" : "hidden"}`}>
          <IqcItemTab />
        </div>
        <div className={`h-full ${activeTab === "perItem" ? "" : "hidden"}`}>
          <div className="grid grid-cols-12 gap-6 h-full">
            <div className="col-span-4 min-h-0">
              <ItemListPanel
                parts={parts}
                linkCountMap={specCountMap}
                selectedItemCode={selectedItemCode}
                onSelect={setSelectedItemCode}
                searchText={searchText}
                onSearchChange={setSearchText}
                loading={partsLoading}
              />
            </div>
            <div className="col-span-8 min-h-0">
              <IqcSpecPanel
                itemCode={selectedItemCode}
                itemName={selectedItemName}
                poolItems={poolItems}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 11: IqcItemTab 단순화 (선택적)

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/master/iqc-item/components/IqcItemTab.tsx`

검사항목 마스터 탭에서 LSL/USL/규격(criteria)/리비전/적용일 컬럼은 불필요하다.
단순화가 필요하면 아래 컬럼만 남긴다:

| 컬럼 | 표시 여부 |
|------|---------|
| 검사코드 (inspItemCode) | 유지 |
| 검사명 (inspItemName) | 유지 |
| 검사종류 (judgeMethod) | 유지 (판정형/측정형 뱃지) |
| 단위 (unit) | 유지 |
| 사용여부 (useYn) | 유지 |
| criteria, lsl, usl, revision, remark | **숨김** (모달 폼에서도 제거) |

> 이 단계는 기존 IqcItemTab.tsx를 부분 수정한다. 기존 파일이 길면 컬럼 정의와 폼 필드만 변경.

---

## Task 12: 빌드 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 백엔드 빌드**

```bash
cd /c/Project/HANES && pnpm --filter backend build 2>&1 | tail -20
```

Expected: `Found 0 errors.`

- [ ] **Step 2: 프론트엔드 빌드**

```bash
cd /c/Project/HANES && pnpm --filter frontend build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` (또는 Route 목록 표시).

- [ ] **Step 3: API 동작 확인**

```bash
# 품목별 IQC 기준 목록 조회
curl -s -X GET http://localhost:3000/master/iqc-part-specs \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

Expected: 숫자 반환 (0 이상).

---

## Self-Review

**Spec 대조:**
- ✅ 검사항목 마스터 (코드/명/종류/단위/사용여부) → Task 11에서 IqcItemTab 단순화
- ✅ 품목별 시료수 설정 → IqcPartSpec.sampleQty
- ✅ 품목별 파괴검사여부 → IqcPartSpec.isDest
- ✅ 품목별 검사항목 선택 + LSL/USL → IqcPartSpecItem
- ✅ 실적 입력 시 시료수는 기본값 (API에서 sampleQty 제공) → 수혜 모듈(material/iqc)에서 이 API 참조 가능
- ✅ 판정형 항목 LSL/USL 입력 불가 → IqcSpecPanel에서 isMeasure 체크

**미처리 항목:**
- Task 5에서 `@UserId()` 데코레이터 존재 여부 → Task 7에서 확인 분기 처리 완료
- `ItemListPanel`의 `linkCountMap` prop은 기존과 동일하게 재사용 (specCountMap으로 교체) → Task 10에서 처리
