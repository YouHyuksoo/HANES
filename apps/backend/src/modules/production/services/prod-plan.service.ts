/**
 * @file src/modules/production/services/prod-plan.service.ts
 * @description 월간생산계획 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 개별/일괄 생성, 수정, 삭제
 * 2. **상태 관리**: DRAFT → CONFIRMED → CLOSED 워크플로우
 * 3. **planNo 자동생성**: PP-YYYYMM-NNN 형식
 * 4. **트랜잭션**: bulkCreate는 전체 원자성 보장
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  CreateProdPlanDto,
  BulkCreateProdPlanDto,
  UpdateProdPlanDto,
  ProdPlanQueryDto,
} from '../dto/prod-plan.dto';

@Injectable()
export class ProdPlanService {
  private readonly logger = new Logger(ProdPlanService.name);

  constructor(
    @InjectRepository(ProdPlan)
    private readonly planRepo: Repository<ProdPlan>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /** 목록 조회 (필터, 페이징, part join) */
  async findAll(query: ProdPlanQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, planMonth, itemType, status, search, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.planRepo
      .createQueryBuilder('pp')
      .leftJoinAndSelect('pp.part', 'part');

    if (company) qb.andWhere('pp.company = :company', { company });
    if (plant) qb.andWhere('pp.plant = :plant', { plant });
    if (planMonth) qb.andWhere('pp.planMonth = :planMonth', { planMonth });
    if (startDate) qb.andWhere('pp.createdAt >= :startDate', { startDate: `${startDate} 00:00:00` });
    if (endDate) qb.andWhere('pp.createdAt <= :endDate', { endDate: `${endDate} 23:59:59` });
    if (itemType) qb.andWhere('pp.itemType = :itemType', { itemType });
    if (status) qb.andWhere('pp.status = :status', { status });
    if (search) {
      qb.andWhere(
        '(LOWER(pp.planNo) LIKE :search OR LOWER(pp.itemCode) LIKE :search OR LOWER(part.itemName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('pp.priority', 'ASC')
      .addOrderBy('pp.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();
    return { data, total, page, limit };
  }

  /** 개별 등록 (planNo 자동생성) */
  async create(dto: CreateProdPlanDto, company?: string, plant?: string) {
    const part = await this.partRepo.findOne({ where: { itemCode: dto.itemCode } });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.itemCode}`);

    const planNo = await this.generatePlanNo(dto.planMonth);

    const plan = this.planRepo.create({
      planNo,
      planMonth: dto.planMonth,
      itemCode: dto.itemCode,
      itemType: dto.itemType,
      planQty: dto.planQty,
      customer: dto.customer || null,
      lineCode: dto.lineCode || null,
      priority: dto.priority ?? 5,
      remark: dto.remark || null,
      status: 'DRAFT',
      company: company || null,
      plant: plant || null,
    });

    const saved = await this.planRepo.save(plan);
    return this.planRepo.findOne({ where: { id: saved.id }, relations: ['part'] });
  }

  /** 엑셀 일괄 등록 (트랜잭션) */
  async bulkCreate(dto: BulkCreateProdPlanDto, company?: string, plant?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: ProdPlan[] = [];

      for (const item of dto.items) {
        const part = await this.partRepo.findOne({ where: { itemCode: item.itemCode } });
        if (!part) {
          throw new BadRequestException(`품목을 찾을 수 없습니다: ${item.itemCode}`);
        }

        const planNo = await this.generatePlanNo(dto.planMonth, queryRunner);

        const plan = queryRunner.manager.create(ProdPlan, {
          planNo,
          planMonth: dto.planMonth,
          itemCode: item.itemCode,
          itemType: item.itemType,
          planQty: item.planQty,
          customer: item.customer || null,
          lineCode: item.lineCode || null,
          priority: item.priority ?? 5,
          remark: item.remark || null,
          status: 'DRAFT',
          company: company || null,
          plant: plant || null,
        });

        const saved = await queryRunner.manager.save(plan);
        results.push(saved);
      }

      await queryRunner.commitTransaction();
      return { count: results.length, items: results };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수정 (DRAFT 상태만) */
  async update(id: number, dto: UpdateProdPlanDto) {
    const plan = await this.findById(id);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안(DRAFT) 상태의 계획만 수정할 수 있습니다.');
    }

    const updateData: Partial<ProdPlan> = {};
    if (dto.itemCode !== undefined) updateData.itemCode = dto.itemCode;
    if (dto.itemType !== undefined) updateData.itemType = dto.itemType;
    if (dto.planQty !== undefined) updateData.planQty = dto.planQty;
    if (dto.customer !== undefined) updateData.customer = dto.customer || null;
    if (dto.lineCode !== undefined) updateData.lineCode = dto.lineCode || null;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.remark !== undefined) updateData.remark = dto.remark || null;

    await this.planRepo.update({ id }, updateData);
    return this.planRepo.findOne({ where: { id }, relations: ['part'] });
  }

  /** 삭제 (DRAFT 상태만) */
  async delete(id: number) {
    const plan = await this.findById(id);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안(DRAFT) 상태의 계획만 삭제할 수 있습니다.');
    }
    await this.planRepo.delete({ id });
    return { id };
  }

  /** 확정 (DRAFT → CONFIRMED) */
  async confirm(id: number) {
    const plan = await this.findById(id);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안(DRAFT) 상태의 계획만 확정할 수 있습니다.');
    }
    await this.planRepo.update({ id }, { status: 'CONFIRMED' });
    return this.planRepo.findOne({ where: { id }, relations: ['part'] });
  }

  /** 일괄 확정 */
  async bulkConfirm(ids: number[]) {
    let count = 0;
    for (const id of ids) {
      const plan = await this.planRepo.findOne({ where: { id } });
      if (plan && plan.status === 'DRAFT') {
        await this.planRepo.update({ id }, { status: 'CONFIRMED' });
        count++;
      }
    }
    return { count };
  }

  /** 확정 취소 (CONFIRMED → DRAFT) */
  async unconfirm(id: number) {
    const plan = await this.findById(id);
    if (plan.status !== 'CONFIRMED') {
      throw new BadRequestException('확정(CONFIRMED) 상태의 계획만 취소할 수 있습니다.');
    }
    await this.planRepo.update({ id }, { status: 'DRAFT' });
    return this.planRepo.findOne({ where: { id }, relations: ['part'] });
  }

  /** 마감 (CONFIRMED → CLOSED) */
  async close(id: number) {
    const plan = await this.findById(id);
    if (plan.status !== 'CONFIRMED') {
      throw new BadRequestException('확정(CONFIRMED) 상태의 계획만 마감할 수 있습니다.');
    }
    await this.planRepo.update({ id }, { status: 'CLOSED' });
    return this.planRepo.findOne({ where: { id }, relations: ['part'] });
  }

  /** 월간 집계 (FG/WIP별 수량, 상태별 건수) */
  async getSummary(month: string) {
    const qb = this.planRepo.createQueryBuilder('pp')
      .where('pp.planMonth = :month', { month });

    const [plans, total] = await qb.getManyAndCount();

    const summary = {
      total,
      draft: 0,
      confirmed: 0,
      closed: 0,
      fgCount: 0,
      wipCount: 0,
      fgPlanQty: 0,
      wipPlanQty: 0,
      totalPlanQty: 0,
      totalOrderQty: 0,
    };

    for (const p of plans) {
      if (p.status === 'DRAFT') summary.draft++;
      else if (p.status === 'CONFIRMED') summary.confirmed++;
      else if (p.status === 'CLOSED') summary.closed++;

      if (p.itemType === 'FG') {
        summary.fgCount++;
        summary.fgPlanQty += p.planQty;
      } else {
        summary.wipCount++;
        summary.wipPlanQty += p.planQty;
      }

      summary.totalPlanQty += p.planQty;
      summary.totalOrderQty += p.orderQty;
    }

    return summary;
  }

  /** 단건 조회 (내부) */
  private async findById(id: number) {
    const plan = await this.planRepo.findOne({ where: { id }, relations: ['part'] });
    if (!plan) throw new NotFoundException(`생산계획을 찾을 수 없습니다: ${id}`);
    return plan;
  }

  /** planNo 자동생성: PP-YYYYMM-NNN */
  private async generatePlanNo(planMonth: string, queryRunner?: any): Promise<string> {
    const prefix = `PP-${planMonth.replace('-', '')}-`;
    const repo = queryRunner ? queryRunner.manager.getRepository(ProdPlan) : this.planRepo;

    const last = await repo
      .createQueryBuilder('pp')
      .where('pp.planNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('pp.planNo', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const lastSeq = parseInt(last.planNo.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }
}
