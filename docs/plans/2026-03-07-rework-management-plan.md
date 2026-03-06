# 재작업관리(Rework Management) 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** IATF 16949 8.7.1 준수 재작업관리 모듈 — 2단계 승인, 재검사, 이력 추적

**Architecture:** Quality 모듈 하위에 ReworkOrder/ReworkInspect 엔티티 추가. DefectLog와 FK 연결. 프론트엔드 3개 페이지(실적입력, 재검사, 현황).

**Tech Stack:** NestJS + TypeORM (backend), Next.js + React (frontend), i18n (ko/en/zh/vi), ComCode

**Design Doc:** `docs/plans/2026-03-07-rework-management-design.md`

---

### Task 1: 공통코드 상수 추가

**Files:**
- Modify: `packages/shared/src/constants/com-code-values.ts`

**Step 1: 재작업 상태/방법 상수 추가**

기존 `REPAIR_RESULT_VALUES` 아래에 추가:

```typescript
/** 재작업 상태 */
export const REWORK_STATUS_VALUES = [
  'REGISTERED', 'QC_PENDING', 'QC_APPROVED', 'QC_REJECTED',
  'PROD_PENDING', 'APPROVED', 'PROD_REJECTED',
  'IN_PROGRESS', 'REWORK_DONE', 'INSPECT_PENDING',
  'PASS', 'FAIL', 'SCRAP',
] as const;
export type ReworkStatusValue = typeof REWORK_STATUS_VALUES[number];

/** 재작업 검사 결과 */
export const REWORK_INSPECT_RESULT_VALUES = ['PASS', 'FAIL', 'SCRAP'] as const;
export type ReworkInspectResultValue = typeof REWORK_INSPECT_RESULT_VALUES[number];
```

**Step 2: Commit**

```bash
git add packages/shared/src/constants/com-code-values.ts
git commit -m "feat(shared): add REWORK_STATUS_VALUES, REWORK_INSPECT_RESULT_VALUES constants"
```

---

### Task 2: ReworkOrder 엔티티 생성

**Files:**
- Create: `apps/backend/src/entities/rework-order.entity.ts`
- Modify: `apps/backend/src/entities/index.ts`

**Step 1: ReworkOrder 엔티티 작성**

기존 `defect-log.entity.ts` 패턴을 따름. 주요 참고:
- `@PrimaryGeneratedColumn()` (number 시퀀스)
- `@ManyToOne()` + `@JoinColumn()` 관계
- `@Index()` 검색용 컬럼
- `@CreateDateColumn()`, `@UpdateDateColumn()` 자동 타임스탬프
- `company`, `plant`, `createdBy`, `updatedBy` tenancy 칼럼

```typescript
/**
 * @file rework-order.entity.ts
 * @description 재작업 지시 엔티티 — IATF 16949 8.7.1 부적합 출력물 재작업 관리
 *
 * 초보자 가이드:
 * 1. DefectLog에서 재작업 판정된 불량품에 대한 재작업 지시를 관리
 * 2. 2단계 승인: 품질담당 → 생산담당 순서로 승인
 * 3. 상태 흐름: REGISTERED → QC_PENDING → ... → PASS/FAIL/SCRAP
 */
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { DefectLog } from './defect-log.entity';

@Entity('rework_orders')
@Index(['company', 'plant', 'status'])
@Index(['company', 'plant', 'reworkNo'], { unique: true })
export class ReworkOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rework_no', length: 30 })
  reworkNo: string;

  @Column({ name: 'defect_log_id', nullable: true })
  defectLogId: number;

  @ManyToOne(() => DefectLog, { nullable: true })
  @JoinColumn({ name: 'defect_log_id' })
  defectLog: DefectLog;

  @Column({ name: 'item_code', length: 50 })
  itemCode: string;

  @Column({ name: 'item_name', length: 200, nullable: true })
  itemName: string;

  @Column({ name: 'prd_uid', length: 80, nullable: true })
  prdUid: string;

  @Column({ name: 'rework_qty', type: 'int', default: 0 })
  reworkQty: number;

  @Column({ name: 'defect_type', length: 50, nullable: true })
  defectType: string;

  @Column({ name: 'rework_method', length: 500, nullable: true })
  reworkMethod: string;

  @Column({ name: 'status', length: 30, default: 'REGISTERED' })
  @Index()
  status: string;

  @Column({ name: 'qc_approver_code', length: 50, nullable: true })
  qcApproverCode: string;

  @Column({ name: 'qc_approved_at', type: 'timestamptz', nullable: true })
  qcApprovedAt: Date;

  @Column({ name: 'qc_reject_reason', length: 500, nullable: true })
  qcRejectReason: string;

  @Column({ name: 'prod_approver_code', length: 50, nullable: true })
  prodApproverCode: string;

  @Column({ name: 'prod_approved_at', type: 'timestamptz', nullable: true })
  prodApprovedAt: Date;

  @Column({ name: 'prod_reject_reason', length: 500, nullable: true })
  prodRejectReason: string;

  @Column({ name: 'worker_code', length: 50, nullable: true })
  workerCode: string;

  @Column({ name: 'line_code', length: 50, nullable: true })
  lineCode: string;

  @Column({ name: 'equip_code', length: 50, nullable: true })
  equipCode: string;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date;

  @Column({ name: 'result_qty', type: 'int', default: 0 })
  resultQty: number;

  @Column({ name: 'pass_qty', type: 'int', default: 0 })
  passQty: number;

  @Column({ name: 'fail_qty', type: 'int', default: 0 })
  failQty: number;

  @Column({ name: 'isolation_flag', type: 'boolean', default: true })
  isolationFlag: boolean;

  @Column({ name: 'remarks', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl: string;

  @Column({ name: 'company', type: 'int' })
  company: number;

  @Column({ name: 'plant', length: 20 })
  plant: string;

  @Column({ name: 'created_by', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Step 2: entities/index.ts에 export 추가**

기존 quality 섹션 (`repair-log` 근처)에 추가:

```typescript
export * from './rework-order.entity';
```

**Step 3: Commit**

```bash
git add apps/backend/src/entities/rework-order.entity.ts apps/backend/src/entities/index.ts
git commit -m "feat(entity): add ReworkOrder entity for IATF 16949 rework management"
```

---

### Task 3: ReworkInspect 엔티티 생성

**Files:**
- Create: `apps/backend/src/entities/rework-inspect.entity.ts`
- Modify: `apps/backend/src/entities/index.ts`

**Step 1: ReworkInspect 엔티티 작성**

```typescript
/**
 * @file rework-inspect.entity.ts
 * @description 재작업 후 검사 엔티티 — IATF 16949 재작업 후 재검증 기록
 *
 * 초보자 가이드:
 * 1. ReworkOrder 완료 후 재검사 결과를 기록
 * 2. 검사 결과: PASS(합격), FAIL(불합격), SCRAP(폐기)
 * 3. 재작업 후 요구사항 충족 여부를 재검증하는 IATF 필수 프로세스
 */
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ReworkOrder } from './rework-order.entity';

@Entity('rework_inspects')
@Index(['company', 'plant', 'reworkOrderId'])
export class ReworkInspect {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rework_order_id' })
  reworkOrderId: number;

  @ManyToOne(() => ReworkOrder)
  @JoinColumn({ name: 'rework_order_id' })
  reworkOrder: ReworkOrder;

  @Column({ name: 'inspector_code', length: 50 })
  inspectorCode: string;

  @Column({ name: 'inspect_at', type: 'timestamptz', nullable: true })
  inspectAt: Date;

  @Column({ name: 'inspect_method', length: 500, nullable: true })
  inspectMethod: string;

  @Column({ name: 'inspect_result', length: 30 })
  inspectResult: string;

  @Column({ name: 'pass_qty', type: 'int', default: 0 })
  passQty: number;

  @Column({ name: 'fail_qty', type: 'int', default: 0 })
  failQty: number;

  @Column({ name: 'defect_detail', length: 1000, nullable: true })
  defectDetail: string;

  @Column({ name: 'remarks', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl: string;

  @Column({ name: 'company', type: 'int' })
  company: number;

  @Column({ name: 'plant', length: 20 })
  plant: string;

  @Column({ name: 'created_by', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Step 2: entities/index.ts에 export 추가**

```typescript
export * from './rework-inspect.entity';
```

**Step 3: Commit**

```bash
git add apps/backend/src/entities/rework-inspect.entity.ts apps/backend/src/entities/index.ts
git commit -m "feat(entity): add ReworkInspect entity for post-rework verification"
```

---

### Task 4: Rework DTO 생성

**Files:**
- Create: `apps/backend/src/modules/quality/dto/rework.dto.ts`

**Step 1: DTO 작성**

기존 `defect-log.dto.ts` 패턴 참조. `@ApiProperty`, `@IsIn`, `@Type`, `PartialType` 사용.

```typescript
/**
 * @file rework.dto.ts
 * @description 재작업 지시 DTO — 생성, 수정, 조회, 승인 요청
 *
 * 초보자 가이드:
 * 1. CreateReworkOrderDto: 재작업 지시 등록 시 사용
 * 2. UpdateReworkOrderDto: 수정 시 사용 (PartialType)
 * 3. ReworkQueryDto: 목록 조회 필터/페이지네이션
 * 4. ApproveReworkDto: 승인/반려 요청
 * 5. CompleteReworkDto: 작업 완료 시 결과 입력
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsIn, IsBoolean, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { REWORK_STATUS_VALUES } from '@hanes/shared';

export class CreateReworkOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defectLogId?: number;

  @ApiProperty()
  @IsString()
  itemCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prdUid?: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  reworkQty: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defectType?: string;

  @ApiProperty({ description: 'IATF: 승인된 재작업 방법' })
  @IsString()
  reworkMethod: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workerCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateReworkOrderDto extends PartialType(CreateReworkOrderDto) {}

export class ReworkQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defectType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class ApproveReworkDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: '반려 시 사유' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CompleteReworkDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  resultQty: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateReworkInspectDto {
  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  reworkOrderId: number;

  @ApiProperty()
  @IsString()
  inspectorCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inspectMethod?: string;

  @ApiProperty({ enum: ['PASS', 'FAIL', 'SCRAP'] })
  @IsIn(['PASS', 'FAIL', 'SCRAP'])
  inspectResult: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  passQty: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  failQty: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defectDetail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/modules/quality/dto/rework.dto.ts
git commit -m "feat(dto): add Rework DTOs (create, update, query, approve, inspect)"
```

---

### Task 5: ReworkService 생성

**Files:**
- Create: `apps/backend/src/modules/quality/services/rework.service.ts`

**Step 1: 서비스 작성**

기존 `defect-log.service.ts` 패턴 참조. Repository 주입, CRUD, 상태 전환 검증, 통계.

```typescript
/**
 * @file rework.service.ts
 * @description 재작업 관리 서비스 — 2단계 승인, 재작업 실적, 재검사 연동
 *
 * 초보자 가이드:
 * 1. 재작업 지시 CRUD + 2단계 승인 (품질 → 생산)
 * 2. 상태 흐름: REGISTERED → QC_PENDING → ... → PASS/FAIL/SCRAP
 * 3. 재검사 등록 시 ReworkOrder 상태 자동 업데이트
 * 4. reworkNo 자동채번: RW-YYYYMMDD-NNN
 */
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, ILike } from 'typeorm';
import { ReworkOrder, ReworkInspect, DefectLog } from '@/entities';
import {
  CreateReworkOrderDto, UpdateReworkOrderDto, ReworkQueryDto,
  ApproveReworkDto, CompleteReworkDto, CreateReworkInspectDto,
} from '../dto/rework.dto';

@Injectable()
export class ReworkService {
  private readonly logger = new Logger(ReworkService.name);

  constructor(
    @InjectRepository(ReworkOrder)
    private readonly reworkRepo: Repository<ReworkOrder>,
    @InjectRepository(ReworkInspect)
    private readonly inspectRepo: Repository<ReworkInspect>,
    @InjectRepository(DefectLog)
    private readonly defectLogRepo: Repository<DefectLog>,
  ) {}

  /** 재작업번호 자동채번: RW-YYYYMMDD-NNN */
  private async generateReworkNo(company: number, plant: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RW-${dateStr}-`;

    const last = await this.reworkRepo
      .createQueryBuilder('r')
      .where('r.company = :company', { company })
      .andWhere('r.plant = :plant', { plant })
      .andWhere('r.rework_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('r.rework_no', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.reworkNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  /** 목록 조회 */
  async findAll(query: ReworkQueryDto, company?: number, plant?: string) {
    const { page = 1, limit = 50, status, defectType, lineCode, search, startDate, endDate } = query;
    const qb = this.reworkRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.defectLog', 'dl');

    if (company) qb.andWhere('r.company = :company', { company });
    if (plant) qb.andWhere('r.plant = :plant', { plant });
    if (status) qb.andWhere('r.status = :status', { status });
    if (defectType) qb.andWhere('r.defect_type = :defectType', { defectType });
    if (lineCode) qb.andWhere('r.line_code = :lineCode', { lineCode });
    if (search) {
      qb.andWhere('(r.rework_no ILIKE :s OR r.item_code ILIKE :s OR r.item_name ILIKE :s)', { s: `%${search}%` });
    }
    if (startDate && endDate) {
      qb.andWhere('r.created_at BETWEEN :startDate AND :endDate', { startDate, endDate: `${endDate}T23:59:59` });
    }

    qb.orderBy('r.created_at', 'DESC');
    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { data, total, page, limit };
  }

  /** 단건 조회 */
  async findById(id: number) {
    const item = await this.reworkRepo.findOne({
      where: { id },
      relations: ['defectLog'],
    });
    if (!item) throw new NotFoundException('재작업 지시를 찾을 수 없습니다.');
    return item;
  }

  /** 등록 */
  async create(dto: CreateReworkOrderDto, company: number, plant: string, userId: string) {
    const reworkNo = await this.generateReworkNo(company, plant);
    const entity = this.reworkRepo.create({
      ...dto,
      reworkNo,
      status: 'REGISTERED',
      isolationFlag: true,
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.reworkRepo.save(entity);

    // 불량 이력 상태 연동
    if (dto.defectLogId) {
      await this.defectLogRepo.update(dto.defectLogId, { status: 'REWORK' });
    }

    this.logger.log(`재작업 등록: ${reworkNo} (defectLogId: ${dto.defectLogId})`);
    return saved;
  }

  /** 수정 */
  async update(id: number, dto: UpdateReworkOrderDto, userId: string) {
    const item = await this.findById(id);
    if (!['REGISTERED', 'QC_REJECTED', 'PROD_REJECTED'].includes(item.status)) {
      throw new BadRequestException('등록/반려 상태에서만 수정할 수 있습니다.');
    }
    Object.assign(item, dto, { updatedBy: userId });
    return this.reworkRepo.save(item);
  }

  /** 삭제 */
  async delete(id: number) {
    const item = await this.findById(id);
    if (item.status !== 'REGISTERED') {
      throw new BadRequestException('등록 상태에서만 삭제할 수 있습니다.');
    }
    await this.reworkRepo.remove(item);
  }

  /** 품질승인 요청 (REGISTERED → QC_PENDING) */
  async requestQcApproval(id: number, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'REGISTERED') {
      throw new BadRequestException('등록 상태에서만 승인 요청할 수 있습니다.');
    }
    item.status = 'QC_PENDING';
    item.updatedBy = userId;
    return this.reworkRepo.save(item);
  }

  /** 품질 승인/반려 */
  async qcApprove(id: number, dto: ApproveReworkDto, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'QC_PENDING') {
      throw new BadRequestException('품질승인대기 상태가 아닙니다.');
    }
    if (dto.action === 'APPROVE') {
      item.status = 'PROD_PENDING';
      item.qcApproverCode = userId;
      item.qcApprovedAt = new Date();
    } else {
      item.status = 'QC_REJECTED';
      item.qcApproverCode = userId;
      item.qcRejectReason = dto.reason;
    }
    item.updatedBy = userId;
    return this.reworkRepo.save(item);
  }

  /** 생산 승인/반려 */
  async prodApprove(id: number, dto: ApproveReworkDto, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'PROD_PENDING') {
      throw new BadRequestException('생산승인대기 상태가 아닙니다.');
    }
    if (dto.action === 'APPROVE') {
      item.status = 'APPROVED';
      item.prodApproverCode = userId;
      item.prodApprovedAt = new Date();
    } else {
      item.status = 'PROD_REJECTED';
      item.prodApproverCode = userId;
      item.prodRejectReason = dto.reason;
    }
    item.updatedBy = userId;
    return this.reworkRepo.save(item);
  }

  /** 작업 시작 (APPROVED → IN_PROGRESS) */
  async start(id: number, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'APPROVED') {
      throw new BadRequestException('승인 완료 상태에서만 시작할 수 있습니다.');
    }
    item.status = 'IN_PROGRESS';
    item.startAt = new Date();
    item.updatedBy = userId;
    return this.reworkRepo.save(item);
  }

  /** 작업 완료 (IN_PROGRESS → REWORK_DONE → INSPECT_PENDING) */
  async complete(id: number, dto: CompleteReworkDto, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'IN_PROGRESS') {
      throw new BadRequestException('진행중 상태에서만 완료할 수 있습니다.');
    }
    item.status = 'INSPECT_PENDING';
    item.endAt = new Date();
    item.resultQty = dto.resultQty;
    item.remarks = dto.remarks ?? item.remarks;
    item.updatedBy = userId;
    return this.reworkRepo.save(item);
  }

  /** 통계 */
  async getStats(company?: number, plant?: string) {
    const qb = this.reworkRepo.createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.rework_qty), 0)', 'totalQty');

    if (company) qb.andWhere('r.company = :company', { company });
    if (plant) qb.andWhere('r.plant = :plant', { plant });

    qb.groupBy('r.status');
    return qb.getRawMany();
  }

  // ─── 재검사 ───

  /** 재검사 목록 */
  async findInspects(reworkOrderId?: number, company?: number, plant?: string) {
    const qb = this.inspectRepo.createQueryBuilder('ri')
      .leftJoinAndSelect('ri.reworkOrder', 'ro');

    if (reworkOrderId) qb.andWhere('ri.rework_order_id = :reworkOrderId', { reworkOrderId });
    if (company) qb.andWhere('ri.company = :company', { company });
    if (plant) qb.andWhere('ri.plant = :plant', { plant });

    qb.orderBy('ri.created_at', 'DESC');
    return qb.getMany();
  }

  /** 재검사 등록 → ReworkOrder 상태 자동 업데이트 */
  async createInspect(dto: CreateReworkInspectDto, company: number, plant: string, userId: string) {
    const order = await this.findById(dto.reworkOrderId);
    if (order.status !== 'INSPECT_PENDING') {
      throw new BadRequestException('재검사대기 상태가 아닙니다.');
    }

    const inspect = this.inspectRepo.create({
      ...dto,
      inspectAt: new Date(),
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.inspectRepo.save(inspect);

    // ReworkOrder 상태 및 수량 업데이트
    order.status = dto.inspectResult; // PASS, FAIL, SCRAP
    order.passQty = dto.passQty;
    order.failQty = dto.failQty;
    order.isolationFlag = dto.inspectResult !== 'PASS';
    order.updatedBy = userId;
    await this.reworkRepo.save(order);

    // 불량 이력 상태 연동
    if (order.defectLogId) {
      const defectStatus = dto.inspectResult === 'PASS' ? 'DONE'
        : dto.inspectResult === 'SCRAP' ? 'SCRAP' : 'REWORK';
      await this.defectLogRepo.update(order.defectLogId, { status: defectStatus });
    }

    this.logger.log(`재검사 등록: reworkOrderId=${dto.reworkOrderId}, result=${dto.inspectResult}`);
    return saved;
  }

  /** 재검사 단건 조회 */
  async findInspectById(id: number) {
    const item = await this.inspectRepo.findOne({
      where: { id },
      relations: ['reworkOrder'],
    });
    if (!item) throw new NotFoundException('재검사 기록을 찾을 수 없습니다.');
    return item;
  }
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/modules/quality/services/rework.service.ts
git commit -m "feat(service): add ReworkService with 2-stage approval and inspection"
```

---

### Task 6: ReworkController 생성

**Files:**
- Create: `apps/backend/src/modules/quality/controllers/rework.controller.ts`

**Step 1: 컨트롤러 작성**

기존 `defect-log.controller.ts` 패턴 참조. `@Company()`, `@Plant()` 데코레이터, `ResponseUtil`.

```typescript
/**
 * @file rework.controller.ts
 * @description 재작업 관리 API — 재작업 지시 CRUD, 2단계 승인, 재검사
 *
 * 초보자 가이드:
 * 1. /quality/reworks — 재작업 지시 관련 엔드포인트
 * 2. /quality/rework-inspects — 재작업 후 검사 엔드포인트
 * 3. 승인 API: qc-approve (품질), prod-approve (생산)
 */
import {
  Controller, Get, Post, Put, Patch, Delete, Param, Query, Body,
  HttpCode, HttpStatus, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ReworkService } from '../services/rework.service';
import {
  CreateReworkOrderDto, UpdateReworkOrderDto, ReworkQueryDto,
  ApproveReworkDto, CompleteReworkDto, CreateReworkInspectDto,
} from '../dto/rework.dto';
import { Company } from '@/common/decorators/company.decorator';
import { Plant } from '@/common/decorators/plant.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ResponseUtil } from '@/common/utils/response.util';

@ApiTags('재작업관리')
@Controller('quality')
export class ReworkController {
  constructor(private readonly reworkService: ReworkService) {}

  // ─── 재작업 지시 ───

  @Get('reworks/stats')
  @ApiOperation({ summary: '재작업 통계' })
  async getStats(@Company() company: number, @Plant() plant: string) {
    const data = await this.reworkService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('reworks')
  @ApiOperation({ summary: '재작업 목록 조회' })
  async findAll(
    @Query() query: ReworkQueryDto,
    @Company() company: number,
    @Plant() plant: string,
  ) {
    const result = await this.reworkService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('reworks/:id')
  @ApiOperation({ summary: '재작업 단건 조회' })
  @ApiParam({ name: 'id', type: Number })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.reworkService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post('reworks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재작업 등록' })
  async create(
    @Body() dto: CreateReworkOrderDto,
    @Company() company: number,
    @Plant() plant: string,
    @CurrentUser('userId') userId: string,
  ) {
    const data = await this.reworkService.create(dto, company, plant, userId);
    return ResponseUtil.success(data);
  }

  @Put('reworks/:id')
  @ApiOperation({ summary: '재작업 수정' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReworkOrderDto,
    @CurrentUser('userId') userId: string,
  ) {
    const data = await this.reworkService.update(id, dto, userId);
    return ResponseUtil.success(data);
  }

  @Delete('reworks/:id')
  @ApiOperation({ summary: '재작업 삭제' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.reworkService.delete(id);
    return ResponseUtil.success(null);
  }

  @Patch('reworks/:id/request-approval')
  @ApiOperation({ summary: '품질승인 요청 (REGISTERED → QC_PENDING)' })
  async requestApproval(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: string,
  ) {
    const data = await this.reworkService.requestQcApproval(id, userId);
    return ResponseUtil.success(data);
  }

  @Patch('reworks/:id/qc-approve')
  @ApiOperation({ summary: '품질 승인/반려' })
  async qcApprove(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveReworkDto,
    @CurrentUser('userId') userId: string,
  ) {
    const data = await this.reworkService.qcApprove(id, dto, userId);
    return ResponseUtil.success(data);
  }

  @Patch('reworks/:id/prod-approve')
  @ApiOperation({ summary: '생산 승인/반려' })
  async prodApprove(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveReworkDto,
    @CurrentUser('userId') userId: string,
  ) {
    const data = await this.reworkService.prodApprove(id, dto, userId);
    return ResponseUtil.success(data);
  }

  @Patch('reworks/:id/start')
  @ApiOperation({ summary: '작업 시작' })
  async start(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: string,
  ) {
    const data = await this.reworkService.start(id, userId);
    return ResponseUtil.success(data);
  }

  @Patch('reworks/:id/complete')
  @ApiOperation({ summary: '작업 완료' })
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteReworkDto,
    @CurrentUser('userId') userId: string,
  ) {
    const data = await this.reworkService.complete(id, dto, userId);
    return ResponseUtil.success(data);
  }

  // ─── 재작업 후 검사 ───

  @Get('rework-inspects')
  @ApiOperation({ summary: '재검사 목록 조회' })
  async findInspects(
    @Query('reworkOrderId') reworkOrderId: number,
    @Company() company: number,
    @Plant() plant: string,
  ) {
    const data = await this.reworkService.findInspects(reworkOrderId, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('rework-inspects/:id')
  @ApiOperation({ summary: '재검사 단건 조회' })
  async findInspectById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.reworkService.findInspectById(id);
    return ResponseUtil.success(data);
  }

  @Post('rework-inspects')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재검사 결과 등록' })
  async createInspect(
    @Body() dto: CreateReworkInspectDto,
    @Company() company: number,
    @Plant() plant: string,
    @CurrentUser('userId') userId: string,
  ) {
    const data = await this.reworkService.createInspect(dto, company, plant, userId);
    return ResponseUtil.success(data);
  }
}
```

**Step 2: Commit**

```bash
git add apps/backend/src/modules/quality/controllers/rework.controller.ts
git commit -m "feat(controller): add ReworkController with approval and inspection endpoints"
```

---

### Task 7: Quality 모듈에 등록

**Files:**
- Modify: `apps/backend/src/modules/quality/quality.module.ts`

**Step 1: ReworkOrder, ReworkInspect 엔티티 + ReworkController + ReworkService 등록**

imports의 `TypeOrmModule.forFeature([...])` 배열에 추가:
```typescript
import { ReworkOrder, ReworkInspect } from '@/entities';
// forFeature 배열에: ReworkOrder, ReworkInspect
```

controllers 배열에 추가:
```typescript
import { ReworkController } from './controllers/rework.controller';
// controllers: [..., ReworkController]
```

providers 배열에 추가:
```typescript
import { ReworkService } from './services/rework.service';
// providers: [..., ReworkService]
// exports: [..., ReworkService]
```

**Step 2: Commit**

```bash
git add apps/backend/src/modules/quality/quality.module.ts
git commit -m "feat(module): register ReworkOrder/ReworkInspect in quality module"
```

---

### Task 8: i18n 4개 언어 파일 업데이트

**Files:**
- Modify: `apps/frontend/src/locales/ko.json`
- Modify: `apps/frontend/src/locales/en.json`
- Modify: `apps/frontend/src/locales/zh.json`
- Modify: `apps/frontend/src/locales/vi.json`

**Step 1: 각 언어별 키 추가**

quality 섹션 내 기존 키 아래에 rework 관련 키 추가.
메뉴 키도 함께 추가 (`menu.quality.rework` 등).

**ko.json 추가 키:**
```json
"menu.quality.rework": "재작업 실적",
"menu.quality.reworkInspect": "재작업 후 검사",
"menu.quality.reworkHistory": "재작업 현황",
"rework.title": "재작업 실적 입력",
"rework.subtitle": "불량품 재작업 지시를 등록하고 2단계 승인을 관리합니다.",
"rework.inspectTitle": "재작업 후 검사",
"rework.inspectSubtitle": "재작업 완료 건에 대한 재검증 검사 실적을 입력합니다.",
"rework.historyTitle": "재작업 현황",
"rework.historySubtitle": "재작업 이력을 조회하고 추적성을 확인합니다.",
"rework.reworkNo": "재작업번호",
"rework.itemCode": "품목코드",
"rework.itemName": "품목명",
"rework.reworkQty": "재작업수량",
"rework.defectType": "불량유형",
"rework.reworkMethod": "재작업방법",
"rework.worker": "작업자",
"rework.line": "라인",
"rework.equip": "설비",
"rework.resultQty": "결과수량",
"rework.passQty": "합격수량",
"rework.failQty": "불합격수량",
"rework.isolation": "격리상태",
"rework.create": "재작업 등록",
"rework.edit": "재작업 수정",
"rework.requestApproval": "승인요청",
"rework.qcApprove": "품질승인",
"rework.prodApprove": "생산승인",
"rework.approve": "승인",
"rework.reject": "반려",
"rework.rejectReason": "반려사유",
"rework.start": "작업시작",
"rework.complete": "작업완료",
"rework.inspect": "재검사",
"rework.inspectorCode": "검사자",
"rework.inspectMethod": "검사방법",
"rework.inspectResult": "검사결과",
"rework.defectDetail": "불량상세",
"rework.status.REGISTERED": "등록",
"rework.status.QC_PENDING": "품질승인대기",
"rework.status.QC_APPROVED": "품질승인",
"rework.status.QC_REJECTED": "품질반려",
"rework.status.PROD_PENDING": "생산승인대기",
"rework.status.APPROVED": "생산승인",
"rework.status.PROD_REJECTED": "생산반려",
"rework.status.IN_PROGRESS": "진행중",
"rework.status.REWORK_DONE": "재작업완료",
"rework.status.INSPECT_PENDING": "재검사대기",
"rework.status.PASS": "합격",
"rework.status.FAIL": "불합격",
"rework.status.SCRAP": "폐기",
"rework.stats.total": "전체",
"rework.stats.pending": "승인대기",
"rework.stats.inProgress": "진행중",
"rework.stats.done": "완료",
"rework.stats.inspectPending": "재검사대기"
```

**en.json, zh.json, vi.json**도 동일한 키 구조로 각 언어 번역 추가.

**Step 2: Grep으로 4개 파일에 키 존재 확인**

```bash
grep -l "rework.title" apps/frontend/src/locales/*.json
```
Expected: ko.json, en.json, zh.json, vi.json 4개 모두 출력

**Step 3: Commit**

```bash
git add apps/frontend/src/locales/ko.json apps/frontend/src/locales/en.json apps/frontend/src/locales/zh.json apps/frontend/src/locales/vi.json
git commit -m "feat(i18n): add rework management translations (ko/en/zh/vi)"
```

---

### Task 9: 메뉴 설정 추가

**Files:**
- Modify: `apps/frontend/src/config/menuConfig.ts`

**Step 1: Quality 메뉴 하위에 재작업 3개 메뉴 추가**

기존 quality children 배열에서 `QC_DEFECT` 아래에 추가:

```typescript
{ code: "QC_REWORK", labelKey: "menu.quality.rework", path: "/quality/rework" },
{ code: "QC_REWORK_INSPECT", labelKey: "menu.quality.reworkInspect", path: "/quality/rework-inspect" },
{ code: "QC_REWORK_HISTORY", labelKey: "menu.quality.reworkHistory", path: "/quality/rework-history" },
```

**Step 2: Commit**

```bash
git add apps/frontend/src/config/menuConfig.ts
git commit -m "feat(menu): add rework management menus under quality"
```

---

### Task 10: 재작업 실적 입력 페이지

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/rework/page.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/rework/components/ReworkFormModal.tsx`
- Create: `apps/frontend/src/app/(authenticated)/quality/rework/components/ReworkApproveModal.tsx`

**Step 1: page.tsx 작성 (max 300줄)**

기존 `quality/defect/page.tsx` 패턴 참조:
- StatCard 5개 (전체, 승인대기, 진행중, 완료, 재검사대기)
- DataGrid: reworkNo, itemCode, itemName, reworkQty, defectType, status, workerCode, createdAt
- 필터: 기간, 상태, 라인, 검색어
- 모달: 등록(ReworkFormModal), 승인(ReworkApproveModal)
- 상태 배지: ComCodeBadge (REWORK_STATUS)
- 액션 버튼: 승인요청, 품질승인, 생산승인, 작업시작, 작업완료 (상태에 따라 동적)
- 공용 컴포넌트: LineSelect, EquipSelect, WorkerSelect 사용

**Step 2: ReworkFormModal.tsx 작성 (max 200줄)**

- 품목선택 (PartSelect), 수량, 불량유형(ComCodeSelect), 재작업방법(textarea)
- 라인(LineSelect), 설비(EquipSelect), 작업자(WorkerSelect)
- 불량이력 연결 (defectLogId — optional select)

**Step 3: ReworkApproveModal.tsx 작성 (max 200줄)**

- 승인/반려 라디오
- 반려 시 사유 입력 (textarea)
- 품질승인/생산승인 구분 (props로 전달)

**Step 4: Commit**

```bash
git add apps/frontend/src/app/\(authenticated\)/quality/rework/
git commit -m "feat(frontend): add rework entry page with form and approval modals"
```

---

### Task 11: 재작업 후 검사 페이지

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/rework-inspect/page.tsx`

**Step 1: page.tsx 작성 (max 300줄)**

- 재검사 대기 목록 (status=INSPECT_PENDING인 ReworkOrder 조회)
- DataGrid: reworkNo, itemCode, reworkQty, resultQty, workerCode, endAt
- 검사 등록 모달: 검사자(WorkerSelect), 검사방법, 결과(PASS/FAIL/SCRAP), 합격수량, 불합격수량
- 검사 결과 등록 시 ReworkOrder 상태 자동 업데이트

**Step 2: Commit**

```bash
git add apps/frontend/src/app/\(authenticated\)/quality/rework-inspect/
git commit -m "feat(frontend): add rework inspection page for post-rework verification"
```

---

### Task 12: 재작업 현황 페이지

**Files:**
- Create: `apps/frontend/src/app/(authenticated)/quality/rework-history/page.tsx`

**Step 1: page.tsx 작성 (max 300줄)**

- 전체 재작업 이력 조회 (모든 상태)
- DataGrid: reworkNo, itemCode, itemName, reworkQty, passQty, failQty, status, 승인자정보, 검사결과, createdAt
- 필터: 기간, 상태, 라인, 불량유형, 검색어
- StatCard: 전체건수, 합격률, 폐기건수, 평균처리시간
- 상세보기: 행 클릭 시 전체 이력 (등록→승인→작업→검사) 타임라인 표시
- 내보내기: CSV/Excel

**Step 2: Commit**

```bash
git add apps/frontend/src/app/\(authenticated\)/quality/rework-history/
git commit -m "feat(frontend): add rework history page with stats and timeline"
```

---

### Task 13: 빌드 검증 및 최종 커밋

**Step 1: 백엔드 타입체크**

```bash
cd apps/backend && npx tsc --noEmit
```
Expected: 0 errors

**Step 2: 프론트엔드 빌드**

```bash
cd apps/frontend && pnpm build
```
Expected: Build successful

**Step 3: i18n 키 검증**

```bash
grep -c "rework.title" apps/frontend/src/locales/*.json
```
Expected: 각 파일 1 (4개 파일 모두)

**Step 4: 최종 정리 커밋 (필요 시)**

```bash
git add -A
git commit -m "feat: complete rework management module (IATF 16949 8.7.1)"
```

---

## 구현 순서 요약

| Task | 내용 | 의존성 |
|------|------|--------|
| 1 | 공통코드 상수 | 없음 |
| 2 | ReworkOrder 엔티티 | Task 1 |
| 3 | ReworkInspect 엔티티 | Task 2 |
| 4 | DTO | Task 1 |
| 5 | Service | Task 2, 3, 4 |
| 6 | Controller | Task 5 |
| 7 | Module 등록 | Task 2, 3, 5, 6 |
| 8 | i18n | 없음 |
| 9 | 메뉴 설정 | Task 8 |
| 10 | 재작업 실적 페이지 | Task 7, 8, 9 |
| 11 | 재검사 페이지 | Task 7, 8, 9 |
| 12 | 재작업 현황 페이지 | Task 7, 8, 9 |
| 13 | 빌드 검증 | All |

**병렬 가능:** Task 1+8 (독립), Task 2+3+4 (엔티티/DTO), Task 10+11+12 (프론트 3페이지)
