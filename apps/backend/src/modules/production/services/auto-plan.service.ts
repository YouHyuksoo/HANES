/**
 * @file src/modules/production/services/auto-plan.service.ts
 * @description 수주 가져오기 서비스 - 미출하 수주를 조회하여 생산계획(DRAFT)으로 추가한다.
 *
 * 초보자 가이드:
 * 1. **search()**: 납기 기간/고객 조건으로 미출하 수주를 조회한다.
 * 2. **importOrders()**: 선택된 수주를 생산계획(DRAFT)으로 추가한다.
 * 3. 기존 계획은 건드리지 않고 추가만 한다.
 */

import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, In } from 'typeorm';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { CustomerOrder } from '../../../entities/customer-order.entity';
import { CustomerOrderItem } from '../../../entities/customer-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  AutoGeneratePlanDto,
  AutoPlanPreview,
  AutoPlanPreviewItem,
  AutoPlanResult,
} from '../dto/prod-plan.dto';

/** 수주 조회 결과 행 */
interface OrderRow {
  itemCode: string;
  customerId: string;
  customerName: string;
  orderNo: string;
  dueDate: string;
  demandQty: string;
}

@Injectable()
export class AutoPlanService {
  constructor(
    @InjectRepository(ProdPlan)
    private readonly planRepo: Repository<ProdPlan>,
    @InjectRepository(CustomerOrder)
    private readonly orderRepo: Repository<CustomerOrder>,
    @InjectRepository(CustomerOrderItem)
    private readonly orderItemRepo: Repository<CustomerOrderItem>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /** 미출하 수주 조회 */
  async search(
    dto: AutoGeneratePlanDto,
    company: string,
    plant: string,
  ): Promise<AutoPlanPreview> {
    const orders = await this.queryOrders(dto, company, plant);
    const partMap = await this.buildPartNameMap(orders);

    const items: AutoPlanPreviewItem[] = orders.map((o) => {
      const demandQty = Number(o.demandQty);
      return {
        itemCode: o.itemCode,
        itemName: partMap.get(o.itemCode) || o.itemCode,
        customerId: o.customerId,
        customerName: o.customerName,
        orderNo: o.orderNo,
        dueDate: o.dueDate,
        demandQty,
        planQty: demandQty,
      };
    });

    const warnings: string[] = [];
    if (orders.length === 0) {
      warnings.push('해당 기간에 미출하 수주가 없습니다.');
    }

    return { items, workDays: 0, existingDraftCount: 0, warnings };
  }

  /** 선택된 수주를 생산계획으로 추가 */
  async importOrders(
    dto: AutoGeneratePlanDto,
    company: string,
    plant: string,
  ): Promise<AutoPlanResult> {
    const preview = await this.search(dto, company, plant);

    // selectedItems가 있으면 선택된 항목만
    let targetItems = preview.items;
    if (dto.selectedItems && dto.selectedItems.length > 0) {
      const selectedSet = new Set(
        dto.selectedItems.map(s => `${s.itemCode}|${s.customerId}`),
      );
      targetItems = preview.items
        .filter(item => selectedSet.has(`${item.itemCode}|${item.customerId}`))
        .map(item => {
          const sel = dto.selectedItems!.find(
            s => s.itemCode === item.itemCode && s.customerId === item.customerId,
          );
          return sel ? { ...item, planQty: sel.planQty } : item;
        });
    }

    if (targetItems.length === 0) {
      throw new BadRequestException('가져올 수주가 없습니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const created = await this.createPlans(queryRunner, targetItems, dto.month, company, plant);
      await queryRunner.commitTransaction();
      return { created, deletedDrafts: 0, warnings: preview.warnings };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 미출하 수주 조회 쿼리 */
  private async queryOrders(
    dto: AutoGeneratePlanDto,
    company: string,
    plant: string,
  ): Promise<OrderRow[]> {
    const { month, startDate, endDate, customerId } = dto;

    const qb = this.orderItemRepo
      .createQueryBuilder('ci')
      .innerJoin(CustomerOrder, 'co', 'co.orderNo = ci.orderNo')
      .select('ci.itemCode', 'itemCode')
      .addSelect('co.customerId', 'customerId')
      .addSelect('co.customerName', 'customerName')
      .addSelect('co.orderNo', 'orderNo')
      .addSelect("TO_CHAR(co.dueDate, 'YYYY-MM-DD')", 'dueDate')
      .addSelect('(ci.orderQty - ci.shippedQty)', 'demandQty')
      .where('co.company = :company', { company })
      .andWhere('co.plant = :plant', { plant })
      .andWhere('co.status IN (:...statuses)', { statuses: ['RECEIVED', 'CONFIRMED'] })
      .andWhere('(ci.orderQty - ci.shippedQty) > 0');

    if (startDate && endDate) {
      qb.andWhere("co.dueDate >= TO_DATE(:startDate, 'YYYY-MM-DD')", { startDate });
      qb.andWhere("co.dueDate <= TO_DATE(:endDate, 'YYYY-MM-DD')", { endDate });
    } else {
      // 범위 조건으로 인덱스 활용 (TO_CHAR 대신)
      const [year, mon] = month.split('-').map(Number);
      const monthStart = `${month}-01`;
      const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
      qb.andWhere("co.dueDate >= TO_DATE(:monthStart, 'YYYY-MM-DD')", { monthStart });
      qb.andWhere("co.dueDate < TO_DATE(:nextMonth, 'YYYY-MM-DD')", { nextMonth });
    }

    if (customerId) {
      qb.andWhere('co.customerId = :customerId', { customerId });
    }

    return qb
      .orderBy('co.dueDate', 'ASC')
      .addOrderBy('ci.itemCode', 'ASC')
      .getRawMany<OrderRow>();
  }

  /** 품목명 맵 구성 */
  private async buildPartNameMap(orders: OrderRow[]): Promise<Map<string, string>> {
    const codes = [...new Set(orders.map(o => o.itemCode))];
    if (codes.length === 0) return new Map();
    const parts = await this.partRepo
      .createQueryBuilder('p')
      .where('p.itemCode IN (:...codes)', { codes })
      .getMany();
    return new Map(parts.map(p => [p.itemCode, p.itemName]));
  }

  /** 생산계획 일괄 생성 */
  private async createPlans(
    queryRunner: QueryRunner,
    items: AutoPlanPreviewItem[],
    month: string,
    company: string,
    plant: string,
  ): Promise<number> {
    // IN 배치로 품목 선조회 — N+1 방지
    const itemCodes = [...new Set(items.map((i) => i.itemCode))] as const;
    const parts = itemCodes.length > 0
      ? await this.partRepo.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));

    let created = 0;
    for (const item of items) {
      const planNo = await this.generatePlanNo(month, queryRunner);
      const part = partMap.get(item.itemCode);

      const plan = queryRunner.manager.create(ProdPlan, {
        planNo,
        planMonth: month,
        itemCode: item.itemCode,
        itemType: part?.itemType || 'FINISHED',
        planQty: item.planQty,
        orderQty: 0,
        customer: item.customerId,
        lineCode: null,
        priority: 5,
        status: 'DRAFT',
        remark: `수주 가져오기 [${item.orderNo}] ${item.customerName}`,
        company,
        plant,
      });
      await queryRunner.manager.save(plan);
      created++;
    }
    return created;
  }

  /** planNo 자동생성: PP-YYYYMM-NNN */
  private async generatePlanNo(month: string, queryRunner: QueryRunner): Promise<string> {
    const prefix = `PP-${month.replace('-', '')}-`;
    const repo = queryRunner.manager.getRepository(ProdPlan);
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
