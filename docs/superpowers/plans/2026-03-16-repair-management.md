# 수리관리(Repair Management) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 생산관리 메뉴 아래에 수리관리 페이지를 추가하여 수리등록/이력관리/수리실 재고 추적을 구현한다.

**Architecture:** 수리오더 마스터(REPAIR_ORDERS) + 사용부품 디테일(REPAIR_USED_PARTS) 2테이블 구조. 수리오더의 상태값(RECEIVED→IN_REPAIR→COMPLETED)이 수리실 재고 역할. FG_BARCODE 스캔 또는 품목코드+수량 수동등록 모두 지원. 모든 구분값은 ComCode 관리.

**Tech Stack:** NestJS (TypeORM), Next.js (React), TanStack Table v8, Oracle DB, pnpm monorepo

---

## File Structure

### Backend (신규 생성)
- `apps/backend/src/entities/repair-order.entity.ts` — 수리오더 마스터 엔티티
- `apps/backend/src/entities/repair-used-part.entity.ts` — 수리 사용부품 디테일 엔티티
- `apps/backend/src/modules/production/controllers/repair.controller.ts` — 수리관리 API 컨트롤러
- `apps/backend/src/modules/production/services/repair.service.ts` — 수리관리 비즈니스 로직
- `apps/backend/src/modules/production/dto/repair.dto.ts` — 수리관리 DTO

### Backend (수정)
- `apps/backend/src/modules/production/production.module.ts` — RepairController, RepairService, 엔티티 등록

### Frontend (신규 생성)
- `apps/frontend/src/app/(authenticated)/production/repair/page.tsx` — 수리관리 메인 페이지
- `apps/frontend/src/app/(authenticated)/production/repair/components/RepairFormModal.tsx` — 수리 등록/수정 모달

### Frontend (수정)
- `apps/frontend/src/config/menuConfig.ts` — 수리관리 메뉴 추가
- `apps/frontend/src/locales/ko.json` — 한국어 번역 키
- `apps/frontend/src/locales/en.json` — 영어 번역 키
- `apps/frontend/src/locales/zh.json` — 중국어 번역 키
- `apps/frontend/src/locales/vi.json` — 베트남어 번역 키

### Migration (신규 생성)
- `scripts/migration/seed_repair_comcodes.sql` — ComCode 시드 데이터

---

## Chunk 1: Backend — Entity + DTO + Migration

### Task 1: ComCode 시드 SQL 작성

**Files:**
- Create: `scripts/migration/seed_repair_comcodes.sql`

- [ ] **Step 1: ComCode 시드 SQL 작성**

```sql
-- 수리관리 공통코드 시드
-- REPAIR_RESULT: 수리결과
-- DEFECT_GENUINE: 진성/가성
-- DEFECT_TYPE: 불량유형
-- DEFECT_CAUSE: 불량원인
-- DEFECT_POSITION: 불량위치
-- REPAIR_DISPOSITION: 수리후재처리

MERGE INTO "COM_CODES" t
USING (
  -- REPAIR_RESULT (수리결과)
  SELECT 'REPAIR_RESULT' AS "GROUP_CODE", 'COMPLETED' AS "DETAIL_CODE", '수리완료' AS "CODE_NAME",
         1 AS "SORT_ORDER", 'Repair Completed' AS "ATTR1", '修理完成' AS "ATTR2", 'Sửa chữa hoàn tất' AS "ATTR3" FROM DUAL UNION ALL
  SELECT 'REPAIR_RESULT', 'IMPOSSIBLE', '수리불가', 2, 'Irreparable', '无法修理', 'Không thể sửa' FROM DUAL UNION ALL
  SELECT 'REPAIR_RESULT', 'IN_PROGRESS', '수리중', 3, 'In Progress', '修理中', 'Đang sửa chữa' FROM DUAL UNION ALL

  -- DEFECT_GENUINE (진성/가성)
  SELECT 'DEFECT_GENUINE', 'GENUINE', '진성', 1, 'Genuine', '真性', 'Thật' FROM DUAL UNION ALL
  SELECT 'DEFECT_GENUINE', 'FALSE', '가성', 2, 'False', '假性', 'Giả' FROM DUAL UNION ALL

  -- DEFECT_TYPE (불량유형)
  SELECT 'DEFECT_TYPE', 'MATERIAL', '원자재불량', 1, 'Material Defect', '原材料不良', 'Lỗi nguyên liệu' FROM DUAL UNION ALL
  SELECT 'DEFECT_TYPE', 'WORK', '작업불량', 2, 'Work Defect', '作业不良', 'Lỗi tác nghiệp' FROM DUAL UNION ALL

  -- DEFECT_CAUSE (불량원인) — 빈 그룹, 현장 기준 추가
  SELECT 'DEFECT_CAUSE', 'ETC', '기타', 99, 'Others', '其他', 'Khác' FROM DUAL UNION ALL

  -- DEFECT_POSITION (불량위치) — 빈 그룹, 현장 기준 추가
  SELECT 'DEFECT_POSITION', 'ETC', '기타', 99, 'Others', '其他', 'Khác' FROM DUAL UNION ALL

  -- REPAIR_DISPOSITION (수리후재처리)
  SELECT 'REPAIR_DISPOSITION', 'SCRAP', '폐기', 1, 'Scrap', '报废', 'Phế liệu' FROM DUAL UNION ALL
  SELECT 'REPAIR_DISPOSITION', 'REUSE', '재사용', 2, 'Reuse', '再使用', 'Tái sử dụng' FROM DUAL UNION ALL
  SELECT 'REPAIR_DISPOSITION', 'REINSPECT', '재검후재사용', 3, 'Re-inspect & Reuse', '复检后再使用', 'Tái kiểm tra và sử dụng' FROM DUAL UNION ALL
  SELECT 'REPAIR_DISPOSITION', 'PENDING', '판정대기', 4, 'Pending Decision', '判定待定', 'Chờ phán định' FROM DUAL

) s ON (t."COMPANY" = '40' AND t."PLANT_CD" = '1000' AND t."GROUP_CODE" = s."GROUP_CODE" AND t."DETAIL_CODE" = s."DETAIL_CODE")
WHEN NOT MATCHED THEN INSERT (
  "COMPANY", "PLANT_CD", "GROUP_CODE", "DETAIL_CODE", "CODE_NAME", "SORT_ORDER", "USE_YN", "ATTR1", "ATTR2", "ATTR3", "CREATED_BY", "CREATED_AT", "UPDATED_AT"
) VALUES (
  '40', '1000', s."GROUP_CODE", s."DETAIL_CODE", s."CODE_NAME", s."SORT_ORDER", 'Y', s."ATTR1", s."ATTR2", s."ATTR3", 'SYSTEM', SYSDATE, SYSDATE
);
```

- [ ] **Step 2: Oracle DB에 시드 실행**

`oracle-db` 스킬로 JSHANES 사이트에서 실행.

---

### Task 2: RepairOrder 엔티티 생성

**Files:**
- Create: `apps/backend/src/entities/repair-order.entity.ts`

- [ ] **Step 1: RepairOrder 엔티티 작성**

```typescript
/**
 * @file entities/repair-order.entity.ts
 * @description 수리오더 엔티티 - 수리등록/이력/수리실 재고 관리
 *
 * 초보자 가이드:
 * 1. 복합 PK: repairDate(수리일자) + seq(일련번호)
 * 2. 상태(status): RECEIVED(입고) → IN_REPAIR(수리중) → COMPLETED(완료)
 * 3. 수리실 재고 = status가 RECEIVED 또는 IN_REPAIR인 건
 * 4. FG_BARCODE가 있으면 스캔, 없으면 품목코드+수량 수동등록
 * 5. 모든 구분값은 ComCode 관리
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'REPAIR_ORDERS' })
@Index(['status'])
@Index(['itemCode'])
@Index(['fgBarcode'])
@Index(['workerId'])
export class RepairOrder {
  @PrimaryColumn({ name: 'REPAIR_DATE', type: 'date' })
  repairDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'STATUS', length: 50, default: 'RECEIVED' })
  status: string;

  @Column({ name: 'FG_BARCODE', length: 100, nullable: true })
  fgBarcode: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'PRD_UID', length: 50, nullable: true })
  prdUid: string | null;

  @Column({ name: 'SOURCE_PROCESS', length: 50, nullable: true })
  sourceProcess: string | null;

  @Column({ name: 'RETURN_PROCESS', length: 50, nullable: true })
  returnProcess: string | null;

  @Column({ name: 'REPAIR_RESULT', length: 50, nullable: true })
  repairResult: string | null;

  @Column({ name: 'GENUINE_TYPE', length: 50, nullable: true })
  genuineType: string | null;

  @Column({ name: 'DEFECT_TYPE', length: 50, nullable: true })
  defectType: string | null;

  @Column({ name: 'DEFECT_CAUSE', length: 50, nullable: true })
  defectCause: string | null;

  @Column({ name: 'DEFECT_POSITION', length: 50, nullable: true })
  defectPosition: string | null;

  @Column({ name: 'DISPOSITION', length: 50, nullable: true })
  disposition: string | null;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'RECEIVED_AT', type: 'timestamp', nullable: true })
  receivedAt: Date | null;

  @Column({ name: 'COMPLETED_AT', type: 'timestamp', nullable: true })
  completedAt: Date | null;

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
git add apps/backend/src/entities/repair-order.entity.ts
git commit -m "feat: add RepairOrder entity for repair management"
```

---

### Task 3: RepairUsedPart 엔티티 생성

**Files:**
- Create: `apps/backend/src/entities/repair-used-part.entity.ts`

- [ ] **Step 1: RepairUsedPart 엔티티 작성**

```typescript
/**
 * @file entities/repair-used-part.entity.ts
 * @description 수리 사용부품 디테일 엔티티 - 수리에 사용된 품목/시리얼 기록
 *
 * 초보자 가이드:
 * 1. 복합 PK: repairDate + seq (부모 RepairOrder FK)
 * 2. 하나의 수리오더에 여러 사용부품 행 가능
 * 3. itemCode: PartMaster FK, prdUid: 제품 고유식별자(시리얼)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'REPAIR_USED_PARTS' })
export class RepairUsedPart {
  @PrimaryColumn({ name: 'REPAIR_DATE', type: 'date' })
  repairDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string | null;

  @Column({ name: 'PRD_UID', length: 50, nullable: true })
  prdUid: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/entities/repair-used-part.entity.ts
git commit -m "feat: add RepairUsedPart detail entity"
```

---

### Task 4: DTO 작성

**Files:**
- Create: `apps/backend/src/modules/production/dto/repair.dto.ts`

- [ ] **Step 1: DTO 작성**

```typescript
/**
 * @file dto/repair.dto.ts
 * @description 수리관리 DTO - 조회/등록/수정 요청 유효성 검증
 *
 * 초보자 가이드:
 * 1. RepairQueryDto: 목록 조회 필터 (페이징, 상태, 일자 범위 등)
 * 2. CreateRepairUsedPartDto: 사용부품 행 하나
 * 3. CreateRepairDto: 수리 등록 (마스터 + 사용부품 배열)
 * 4. UpdateRepairDto: 수리 수정 (마스터 + 사용부품 전체 교체)
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RepairQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '상태 (RECEIVED, IN_REPAIR, COMPLETED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '수리일자 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  repairDateFrom?: string;

  @ApiPropertyOptional({ description: '수리일자 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  repairDateTo?: string;

  @ApiPropertyOptional({ description: '발생공정' })
  @IsOptional()
  @IsString()
  sourceProcess?: string;

  @ApiPropertyOptional({ description: '수리자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '검색어 (FG바코드, 품목코드, 품목명)' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateRepairUsedPartDto {
  @ApiProperty({ description: '품목코드', example: 'PART-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiPropertyOptional({ description: '제품 고유식별자 (시리얼)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prdUid?: string;

  @ApiPropertyOptional({ description: '사용수량', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class CreateRepairDto {
  @ApiPropertyOptional({ description: '수리일자 (YYYY-MM-DD), 미입력시 오늘' })
  @IsOptional()
  @IsString()
  repairDate?: string;

  @ApiPropertyOptional({ description: 'FG 바코드' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fgBarcode?: string;

  @ApiProperty({ description: '품목코드', example: 'ITEM-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiPropertyOptional({ description: '수량', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number;

  @ApiPropertyOptional({ description: '제품 고유식별자 (시리얼)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prdUid?: string;

  @ApiPropertyOptional({ description: '발생공정 (ComCode)' })
  @IsOptional()
  @IsString()
  sourceProcess?: string;

  @ApiPropertyOptional({ description: '수리후 투입공정 (ComCode)' })
  @IsOptional()
  @IsString()
  returnProcess?: string;

  @ApiPropertyOptional({ description: '수리결과 (ComCode: REPAIR_RESULT)' })
  @IsOptional()
  @IsString()
  repairResult?: string;

  @ApiPropertyOptional({ description: '진성/가성 (ComCode: DEFECT_GENUINE)' })
  @IsOptional()
  @IsString()
  genuineType?: string;

  @ApiPropertyOptional({ description: '불량유형 (ComCode: DEFECT_TYPE)' })
  @IsOptional()
  @IsString()
  defectType?: string;

  @ApiPropertyOptional({ description: '불량원인 (ComCode: DEFECT_CAUSE)' })
  @IsOptional()
  @IsString()
  defectCause?: string;

  @ApiPropertyOptional({ description: '불량위치 (ComCode: DEFECT_POSITION)' })
  @IsOptional()
  @IsString()
  defectPosition?: string;

  @ApiPropertyOptional({ description: '수리후재처리 (ComCode: REPAIR_DISPOSITION)' })
  @IsOptional()
  @IsString()
  disposition?: string;

  @ApiPropertyOptional({ description: '수리자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '수리 사용부품 목록', type: [CreateRepairUsedPartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRepairUsedPartDto)
  usedParts?: CreateRepairUsedPartDto[];
}

export class UpdateRepairDto extends PartialType(CreateRepairDto) {}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/dto/repair.dto.ts
git commit -m "feat: add repair management DTOs"
```

---

## Chunk 2: Backend — Service + Controller + Module 등록

### Task 5: RepairService 작성

**Files:**
- Create: `apps/backend/src/modules/production/services/repair.service.ts`

- [ ] **Step 1: RepairService 작성**

```typescript
/**
 * @file services/repair.service.ts
 * @description 수리관리 서비스 - 수리오더 CRUD + 수리실 재고 조회
 *
 * 초보자 가이드:
 * 1. findAll: 필터 기반 목록 조회 (페이징)
 * 2. findOne: 단건 조회 (사용부품 포함)
 * 3. create: 수리 등록 (트랜잭션: 마스터 + 사용부품)
 * 4. update: 수리 수정 (트랜잭션: 마스터 + 사용부품 전체교체)
 * 5. remove: 수리 삭제 (트랜잭션: 마스터 + 사용부품)
 * 6. getInventory: 수리실 현재고 (status IN RECEIVED, IN_REPAIR)
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, ILike, In } from 'typeorm';
import { RepairOrder } from '../../../entities/repair-order.entity';
import { RepairUsedPart } from '../../../entities/repair-used-part.entity';
import { RepairQueryDto, CreateRepairDto, UpdateRepairDto } from '../dto/repair.dto';

@Injectable()
export class RepairService {
  constructor(
    @InjectRepository(RepairOrder)
    private readonly repairOrderRepo: Repository<RepairOrder>,
    @InjectRepository(RepairUsedPart)
    private readonly repairUsedPartRepo: Repository<RepairUsedPart>,
    private readonly dataSource: DataSource,
  ) {}

  /** 수리 목록 조회 */
  async findAll(query: RepairQueryDto, company: string, plant: string) {
    const { page = 1, limit = 50, status, repairDateFrom, repairDateTo, sourceProcess, workerId, search } = query;

    const where: any = { company, plant };
    if (status) where.status = status;
    if (sourceProcess) where.sourceProcess = sourceProcess;
    if (workerId) where.workerId = workerId;
    if (repairDateFrom && repairDateTo) {
      where.repairDate = Between(new Date(repairDateFrom), new Date(repairDateTo));
    }

    let qb = this.repairOrderRepo.createQueryBuilder('r')
      .where(where)
      .orderBy('r.REPAIR_DATE', 'DESC')
      .addOrderBy('r.SEQ', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb = qb.andWhere(
        '(r.FG_BARCODE LIKE :search OR r.ITEM_CODE LIKE :search OR r.ITEM_NAME LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /** 수리 단건 조회 (사용부품 포함) */
  async findOne(repairDate: string, seq: number, company: string, plant: string) {
    const order = await this.repairOrderRepo.findOne({
      where: { repairDate: new Date(repairDate), seq, company, plant },
    });
    if (!order) {
      throw new NotFoundException(`수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`);
    }
    const usedParts = await this.repairUsedPartRepo.find({
      where: { repairDate: new Date(repairDate), seq, company, plant },
    });
    return { ...order, usedParts };
  }

  /** 수리 등록 */
  async create(dto: CreateRepairDto, company: string, plant: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repairDate = dto.repairDate ? new Date(dto.repairDate) : new Date();

      // SEQ 채번: 해당 날짜의 MAX(SEQ) + 1
      const maxResult = await queryRunner.manager
        .createQueryBuilder(RepairOrder, 'r')
        .select('MAX(r.SEQ)', 'maxSeq')
        .where('r.REPAIR_DATE = :repairDate AND r.COMPANY = :company AND r.PLANT_CD = :plant', {
          repairDate,
          company,
          plant,
        })
        .getRawOne();
      const seq = (maxResult?.maxSeq || 0) + 1;

      // 마스터 저장
      const order = queryRunner.manager.create(RepairOrder, {
        repairDate,
        seq,
        status: 'RECEIVED',
        fgBarcode: dto.fgBarcode || null,
        itemCode: dto.itemCode,
        itemName: dto.itemName || null,
        qty: dto.qty || 1,
        prdUid: dto.prdUid || null,
        sourceProcess: dto.sourceProcess || null,
        returnProcess: dto.returnProcess || null,
        repairResult: dto.repairResult || null,
        genuineType: dto.genuineType || null,
        defectType: dto.defectType || null,
        defectCause: dto.defectCause || null,
        defectPosition: dto.defectPosition || null,
        disposition: dto.disposition || null,
        workerId: dto.workerId || null,
        receivedAt: new Date(),
        remark: dto.remark || null,
        company,
        plant,
        createdBy: userId,
        updatedBy: userId,
      });
      await queryRunner.manager.save(RepairOrder, order);

      // 사용부품 저장
      if (dto.usedParts?.length) {
        const parts = dto.usedParts.map((p) =>
          queryRunner.manager.create(RepairUsedPart, {
            repairDate,
            seq,
            itemCode: p.itemCode,
            itemName: p.itemName || null,
            prdUid: p.prdUid || null,
            qty: p.qty || 1,
            remark: p.remark || null,
            company,
            plant,
            createdBy: userId,
          }),
        );
        await queryRunner.manager.save(RepairUsedPart, parts);
      }

      await queryRunner.commitTransaction();
      return { repairDate, seq };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수리 수정 */
  async update(repairDate: string, seq: number, dto: UpdateRepairDto, company: string, plant: string, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(RepairOrder, {
        where: { repairDate: new Date(repairDate), seq, company, plant },
      });
      if (!existing) {
        throw new NotFoundException(`수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`);
      }

      // 마스터 업데이트
      const { usedParts, ...masterDto } = dto;
      await queryRunner.manager.update(
        RepairOrder,
        { repairDate: new Date(repairDate), seq },
        {
          ...masterDto,
          ...(masterDto.repairDate && { repairDate: new Date(masterDto.repairDate) }),
          updatedBy: userId,
          ...(dto.disposition && dto.disposition !== 'PENDING' && { completedAt: new Date(), status: 'COMPLETED' }),
        },
      );

      // 사용부품 전체 교체
      if (usedParts !== undefined) {
        await queryRunner.manager.delete(RepairUsedPart, {
          repairDate: new Date(repairDate),
          seq,
        });
        if (usedParts?.length) {
          const parts = usedParts.map((p) =>
            queryRunner.manager.create(RepairUsedPart, {
              repairDate: new Date(repairDate),
              seq,
              itemCode: p.itemCode,
              itemName: p.itemName || null,
              prdUid: p.prdUid || null,
              qty: p.qty || 1,
              remark: p.remark || null,
              company,
              plant,
              createdBy: userId,
            }),
          );
          await queryRunner.manager.save(RepairUsedPart, parts);
        }
      }

      await queryRunner.commitTransaction();
      return { repairDate, seq };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수리 삭제 */
  async remove(repairDate: string, seq: number, company: string, plant: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(RepairOrder, {
        where: { repairDate: new Date(repairDate), seq, company, plant },
      });
      if (!existing) {
        throw new NotFoundException(`수리오더를 찾을 수 없습니다: ${repairDate}-${seq}`);
      }

      await queryRunner.manager.delete(RepairUsedPart, {
        repairDate: new Date(repairDate),
        seq,
      });
      await queryRunner.manager.delete(RepairOrder, {
        repairDate: new Date(repairDate),
        seq,
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수리실 현재고 조회 */
  async getInventory(company: string, plant: string) {
    return this.repairOrderRepo.find({
      where: { company, plant, status: In(['RECEIVED', 'IN_REPAIR']) },
      order: { receivedAt: 'ASC' },
    });
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/services/repair.service.ts
git commit -m "feat: add RepairService with CRUD and inventory"
```

---

### Task 6: RepairController 작성

**Files:**
- Create: `apps/backend/src/modules/production/controllers/repair.controller.ts`

- [ ] **Step 1: RepairController 작성**

```typescript
/**
 * @file controllers/repair.controller.ts
 * @description 수리관리 API 컨트롤러 - 수리 CRUD + 수리실 재고 조회
 *
 * 초보자 가이드:
 * 1. GET /production/repairs — 수리 목록 (필터/페이징)
 * 2. GET /production/repairs/inventory — 수리실 현재고
 * 3. GET /production/repairs/:date/:seq — 수리 상세 (사용부품 포함)
 * 4. POST /production/repairs — 수리 등록
 * 5. PUT /production/repairs/:date/:seq — 수리 수정
 * 6. DELETE /production/repairs/:date/:seq — 수리 삭제
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RepairService } from '../services/repair.service';
import { RepairQueryDto, CreateRepairDto, UpdateRepairDto } from '../dto/repair.dto';
import { Company, Plant, UserId } from '../../../common/decorators';
import { ResponseUtil } from '../../../common/utils/response.util';

@ApiTags('생산관리 - 수리관리')
@Controller('production/repairs')
export class RepairController {
  constructor(private readonly repairService: RepairService) {}

  @Get()
  @ApiOperation({ summary: '수리 목록 조회', description: '필터 기반 수리오더 목록 (페이징)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: RepairQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.repairService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('inventory')
  @ApiOperation({ summary: '수리실 현재고', description: '상태가 RECEIVED/IN_REPAIR인 수리오더 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getInventory(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.repairService.getInventory(company, plant);
    return ResponseUtil.success(data);
  }

  @Get(':date/:seq')
  @ApiOperation({ summary: '수리 상세 조회', description: '수리오더 단건 (사용부품 포함)' })
  @ApiParam({ name: 'date', description: '수리일자 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '일련번호' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findOne(
    @Param('date') date: string,
    @Param('seq') seq: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.repairService.findOne(date, +seq, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '수리 등록', description: '수리오더 + 사용부품 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async create(
    @Body() dto: CreateRepairDto,
    @Company() company: string,
    @Plant() plant: string,
    @UserId() userId: string,
  ) {
    const result = await this.repairService.create(dto, company, plant, userId);
    return ResponseUtil.success(result, '수리가 등록되었습니다.');
  }

  @Put(':date/:seq')
  @ApiOperation({ summary: '수리 수정', description: '수리오더 + 사용부품 수정' })
  @ApiParam({ name: 'date', description: '수리일자 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '일련번호' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('date') date: string,
    @Param('seq') seq: number,
    @Body() dto: UpdateRepairDto,
    @Company() company: string,
    @Plant() plant: string,
    @UserId() userId: string,
  ) {
    const result = await this.repairService.update(date, +seq, dto, company, plant, userId);
    return ResponseUtil.success(result, '수리가 수정되었습니다.');
  }

  @Delete(':date/:seq')
  @ApiOperation({ summary: '수리 삭제', description: '수리오더 + 사용부품 삭제' })
  @ApiParam({ name: 'date', description: '수리일자 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '일련번호' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async remove(
    @Param('date') date: string,
    @Param('seq') seq: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.repairService.remove(date, +seq, company, plant);
    return ResponseUtil.success(null, '수리가 삭제되었습니다.');
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/controllers/repair.controller.ts
git commit -m "feat: add RepairController with CRUD endpoints"
```

---

### Task 7: production.module.ts 등록

**Files:**
- Modify: `apps/backend/src/modules/production/production.module.ts`

- [ ] **Step 1: production.module.ts에 엔티티, 컨트롤러, 서비스 등록**

TypeOrmModule.forFeature 배열에 `RepairOrder`, `RepairUsedPart` 추가.
controllers 배열에 `RepairController` 추가.
providers 배열에 `RepairService` 추가.
exports 배열에 `RepairService` 추가.

Import 문:
```typescript
import { RepairOrder } from '../../entities/repair-order.entity';
import { RepairUsedPart } from '../../entities/repair-used-part.entity';
import { RepairController } from './controllers/repair.controller';
import { RepairService } from './services/repair.service';
```

- [ ] **Step 2: 커밋**

```bash
git add apps/backend/src/modules/production/production.module.ts
git commit -m "feat: register RepairController and RepairService in ProductionModule"
```

---

## Chunk 3: Frontend — Page + Components + Menu + i18n

### Task 8: i18n 번역 키 추가 (4개 파일)

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

- [ ] **Step 1: 4개 locale 파일에 production.repair 섹션 추가**

`production` 객체 내에 `repair` 키 추가:

**ko.json:**
```json
"repair": {
  "title": "수리관리",
  "description": "수리등록 및 수리이력을 관리합니다",
  "repairDate": "수리일자",
  "seq": "순번",
  "status": "상태",
  "fgBarcode": "FG 바코드",
  "itemCode": "품목코드",
  "itemName": "품목명",
  "qty": "수량",
  "prdUid": "시리얼",
  "sourceProcess": "발생공정",
  "returnProcess": "투입공정",
  "repairResult": "수리결과",
  "genuineType": "진성/가성",
  "defectType": "불량유형",
  "defectCause": "불량원인",
  "defectPosition": "불량위치",
  "disposition": "수리후재처리",
  "worker": "수리자",
  "receivedAt": "입고일시",
  "completedAt": "완료일시",
  "remark": "비고",
  "registerRepair": "수리등록",
  "editRepair": "수리수정",
  "deleteConfirm": "이 수리건을 삭제하시겠습니까?",
  "searchPlaceholder": "바코드, 품목코드, 품목명 검색...",
  "usedParts": "사용부품",
  "addPart": "부품추가",
  "removePart": "삭제",
  "inventory": "수리실 재고",
  "totalReceived": "입고 건수",
  "totalInRepair": "수리중",
  "totalCompleted": "완료 건수",
  "scanBarcode": "바코드를 스캔하세요"
}
```

**en.json:**
```json
"repair": {
  "title": "Repair Management",
  "description": "Register and manage repair history",
  "repairDate": "Repair Date",
  "seq": "Seq",
  "status": "Status",
  "fgBarcode": "FG Barcode",
  "itemCode": "Item Code",
  "itemName": "Item Name",
  "qty": "Qty",
  "prdUid": "Serial",
  "sourceProcess": "Source Process",
  "returnProcess": "Return Process",
  "repairResult": "Repair Result",
  "genuineType": "Genuine/False",
  "defectType": "Defect Type",
  "defectCause": "Defect Cause",
  "defectPosition": "Defect Position",
  "disposition": "Disposition",
  "worker": "Repairer",
  "receivedAt": "Received At",
  "completedAt": "Completed At",
  "remark": "Remark",
  "registerRepair": "Register Repair",
  "editRepair": "Edit Repair",
  "deleteConfirm": "Are you sure you want to delete this repair?",
  "searchPlaceholder": "Search barcode, item code, item name...",
  "usedParts": "Used Parts",
  "addPart": "Add Part",
  "removePart": "Remove",
  "inventory": "Repair Room Inventory",
  "totalReceived": "Received",
  "totalInRepair": "In Repair",
  "totalCompleted": "Completed",
  "scanBarcode": "Scan barcode"
}
```

**zh.json:**
```json
"repair": {
  "title": "修理管理",
  "description": "登记和管理修理记录",
  "repairDate": "修理日期",
  "seq": "序号",
  "status": "状态",
  "fgBarcode": "FG条码",
  "itemCode": "品目代码",
  "itemName": "品目名称",
  "qty": "数量",
  "prdUid": "序列号",
  "sourceProcess": "发生工序",
  "returnProcess": "投入工序",
  "repairResult": "修理结果",
  "genuineType": "真性/假性",
  "defectType": "不良类型",
  "defectCause": "不良原因",
  "defectPosition": "不良位置",
  "disposition": "修理后处理",
  "worker": "修理人员",
  "receivedAt": "入库时间",
  "completedAt": "完成时间",
  "remark": "备注",
  "registerRepair": "修理登记",
  "editRepair": "修理修改",
  "deleteConfirm": "确定要删除该修理记录吗？",
  "searchPlaceholder": "搜索条码、品目代码、品目名称...",
  "usedParts": "使用部品",
  "addPart": "添加部品",
  "removePart": "删除",
  "inventory": "修理室库存",
  "totalReceived": "入库数",
  "totalInRepair": "修理中",
  "totalCompleted": "完成数",
  "scanBarcode": "请扫描条码"
}
```

**vi.json:**
```json
"repair": {
  "title": "Quản lý sửa chữa",
  "description": "Đăng ký và quản lý lịch sử sửa chữa",
  "repairDate": "Ngày sửa chữa",
  "seq": "STT",
  "status": "Trạng thái",
  "fgBarcode": "Mã vạch FG",
  "itemCode": "Mã hàng",
  "itemName": "Tên hàng",
  "qty": "Số lượng",
  "prdUid": "Số serial",
  "sourceProcess": "Công đoạn phát sinh",
  "returnProcess": "Công đoạn nhập lại",
  "repairResult": "Kết quả sửa chữa",
  "genuineType": "Thật/Giả",
  "defectType": "Loại lỗi",
  "defectCause": "Nguyên nhân lỗi",
  "defectPosition": "Vị trí lỗi",
  "disposition": "Xử lý sau sửa",
  "worker": "Người sửa chữa",
  "receivedAt": "Thời gian nhập",
  "completedAt": "Thời gian hoàn tất",
  "remark": "Ghi chú",
  "registerRepair": "Đăng ký sửa chữa",
  "editRepair": "Sửa đổi",
  "deleteConfirm": "Bạn có chắc muốn xóa bản ghi sửa chữa này?",
  "searchPlaceholder": "Tìm mã vạch, mã hàng, tên hàng...",
  "usedParts": "Linh kiện sử dụng",
  "addPart": "Thêm linh kiện",
  "removePart": "Xóa",
  "inventory": "Kho phòng sửa chữa",
  "totalReceived": "Đã nhập",
  "totalInRepair": "Đang sửa",
  "totalCompleted": "Hoàn tất",
  "scanBarcode": "Quét mã vạch"
}
```

- [ ] **Step 2: Grep으로 4개 파일에 모든 키 존재 확인**

```bash
grep -c "repair" apps/frontend/src/locales/{ko,en,zh,vi}.json
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/locales/{ko,en,zh,vi}.json
git commit -m "feat: add repair management i18n keys (ko/en/zh/vi)"
```

---

### Task 9: 메뉴 등록

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`

- [ ] **Step 1: PRODUCTION children 배열에 수리관리 항목 추가**

```typescript
{ code: "PROD_REPAIR", labelKey: "menu.production.repair", path: "/production/repair" },
```

- [ ] **Step 2: i18n 4개 파일에 menu.production.repair 키 추가**

```
ko: "수리관리"
en: "Repair Management"
zh: "修理管理"
vi: "Quản lý sửa chữa"
```

- [ ] **Step 3: 커밋**

```bash
git add apps/frontend/src/config/menuConfig.ts apps/frontend/src/locales/{ko,en,zh,vi}.json
git commit -m "feat: add repair management menu item"
```

---

### Task 10: RepairFormModal 컴포넌트 작성

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/repair/components/RepairFormModal.tsx`

- [ ] **Step 1: RepairFormModal 컴포넌트 작성 (200줄 이내)**

모달 구성:
- size="xl"
- 상단: 수리 마스터 폼 (2열 그리드)
  - FG_BARCODE (스캔 입력, h-14 + QrCode 아이콘 + Enter 핸들러)
  - 품목 선택 (PartSearchModal 트리거 버튼 + 읽기전용 입력)
  - 수량 (number input)
  - PRD_UID (텍스트)
  - 발생공정 (ProcessSelect, includeAll=false)
  - 수리후 투입공정 (ProcessSelect, includeAll=false)
  - 수리자 (WorkerSelect, includeAll=false)
  - 진성/가성 (ComCodeSelect groupCode="DEFECT_GENUINE", includeAll=false)
  - 불량유형 (ComCodeSelect groupCode="DEFECT_TYPE", includeAll=false)
  - 불량원인 (ComCodeSelect groupCode="DEFECT_CAUSE", includeAll=false)
  - 불량위치 (ComCodeSelect groupCode="DEFECT_POSITION", includeAll=false)
  - 수리결과 (ComCodeSelect groupCode="REPAIR_RESULT", includeAll=false)
  - 수리후재처리 (ComCodeSelect groupCode="REPAIR_DISPOSITION", includeAll=false)
  - 비고 (textarea)
- 하단: 사용부품 테이블 (DataGrid 소형)
  - 툴바: "부품추가" 버튼 (PartSearchModal 트리거)
  - 컬럼: 품목코드, 품목명, PRD_UID (입력), 수량 (입력), 비고 (입력), 삭제 버튼
  - 인라인 편집: input 셀 직접 수정

Props 인터페이스:
```typescript
interface RepairFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: RepairOrder | null; // null이면 신규, 객체면 수정
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/production/repair/components/RepairFormModal.tsx
git commit -m "feat: add RepairFormModal component"
```

---

### Task 11: 수리관리 메인 페이지 작성

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/production/repair/page.tsx`

- [ ] **Step 1: 메인 페이지 작성 (300줄 이내)**

페이지 구성:
- 상단 헤더: 제목 + 설명 + "수리등록" 버튼
- 통계 카드 (3장): 입고 건수(blue), 수리중(amber), 완료(green)
- 필터 영역: 수리일자 기간, 상태(ComCodeSelect), 발생공정(ProcessSelect), 수리자(WorkerSelect), 검색어
- DataGrid: 수리 목록
  - 컬럼: 수리일자, SEQ, 상태(ComCodeBadge), FG바코드, 품목코드, 품목명, 수량, 발생공정, 수리자, 수리결과(ComCodeBadge), 수리후재처리(ComCodeBadge), 등록일시
  - 행 클릭 → RepairFormModal (수정 모드)
- RepairFormModal (등록/수정)
- ConfirmModal (삭제)

API 호출 패턴:
```typescript
// 목록 조회
const fetchData = async () => {
  setLoading(true);
  const params = { page, limit, status, repairDateFrom, repairDateTo, sourceProcess, workerId, search };
  const res = await api.get('/production/repairs', { params });
  setData(res.data.data);
  setTotal(res.data.total);
  setLoading(false);
};

// 삭제
const handleDelete = async (row: RepairOrder) => {
  await api.delete(`/production/repairs/${row.repairDate}/${row.seq}`);
  fetchData();
};
```

- [ ] **Step 2: 커밋**

```bash
git add apps/frontend/src/app/(authenticated)/production/repair/page.tsx
git commit -m "feat: add repair management main page"
```

---

### Task 12: 최종 검증

- [ ] **Step 1: Grep으로 i18n 키 존재 확인**

```bash
grep "production.repair" apps/frontend/src/locales/{ko,en,zh,vi}.json | wc -l
```

4개 파일 모두에 키가 있는지 확인.

- [ ] **Step 2: 빌드 검증**

```bash
cd /c/Project/HANES && pnpm build
```

- [ ] **Step 3: 최종 커밋**

모든 파일이 정상이면 최종 통합 커밋.

```bash
git add -A
git commit -m "feat: 생산관리 - 수리관리 페이지 추가 (수리등록/이력/수리실 재고)"
```
