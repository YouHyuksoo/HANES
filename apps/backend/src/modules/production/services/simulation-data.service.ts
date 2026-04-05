/**
 * @file src/modules/production/services/simulation-data.service.ts
 * @description 시뮬레이션용 데이터 로딩 서비스 - DB에서 월력/CAPA/납기/고객명을 조회한다.
 *
 * 초보자 가이드:
 * 1. SimulationService에서 사용하는 데이터 조회 로직을 분리한 헬퍼 서비스
 * 2. loadWorkDays: 월력에서 작업일 목록 추출
 * 3. loadBottleneckCapa: 품목별 병목 CAPA (MIN(dailyCapa))
 * 4. loadDueDates: 수주에서 납기일 매칭
 * 5. loadCustomerNames: 고객ID → 고객명 매핑
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { ProcessCapa } from '../../../entities/process-capa.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import { ProductStock } from '../../../entities/product-stock.entity';
import { WorkCalendar } from '../../../entities/work-calendar.entity';
import { WorkCalendarDay } from '../../../entities/work-calendar-day.entity';
import { CustomerOrder } from '../../../entities/customer-order.entity';
import { CustomerOrderItem } from '../../../entities/customer-order-item.entity';

/** 공정별 CAPA 정보 (setupTime 포함) */
export interface ProcessCapaInfo {
  processCode: string;
  processName: string;
  dailyCapa: number;
  setupTime: number;
  sortOrder: number;
}

@Injectable()
export class SimulationDataService {
  private readonly logger = new Logger(SimulationDataService.name);

  constructor(
    @InjectRepository(ProcessCapa)
    private readonly capaRepo: Repository<ProcessCapa>,
    @InjectRepository(ProcessMaster)
    private readonly processRepo: Repository<ProcessMaster>,
    @InjectRepository(ProductStock)
    private readonly stockRepo: Repository<ProductStock>,
    @InjectRepository(WorkCalendar)
    private readonly calRepo: Repository<WorkCalendar>,
    @InjectRepository(WorkCalendarDay)
    private readonly dayRepo: Repository<WorkCalendarDay>,
    @InjectRepository(CustomerOrder)
    private readonly orderRepo: Repository<CustomerOrder>,
    @InjectRepository(CustomerOrderItem)
    private readonly orderItemRepo: Repository<CustomerOrderItem>,
  ) {}

  /**
   * 월력에서 해당 월의 작업일 목록을 조회한다.
   * processCd가 null인 공장 공통 월력을 우선 사용한다.
   */
  async loadWorkDays(
    month: string,
    company: string,
    plant: string,
  ): Promise<string[]> {
    const year = month.substring(0, 4);

    const calendar = await this.calRepo
      .createQueryBuilder('c')
      .where('c.company = :company', { company })
      .andWhere('c.plant = :plant', { plant })
      .andWhere('c.calendarYear = :year', { year })
      .andWhere('c.status = :status', { status: 'ACTIVE' })
      .andWhere('c.processCd IS NULL')
      .getOne();

    if (!calendar) {
      this.logger.warn(
        `ACTIVE 상태 공통 월력 없음: ${year}/${company}/${plant}`,
      );
      return [];
    }

    const days = await this.dayRepo
      .createQueryBuilder('d')
      .where('d.calendarId = :calId', { calId: calendar.calendarId })
      .andWhere('d.dayType = :dayType', { dayType: 'WORK' })
      .andWhere('d.workDate >= :startDate AND d.workDate < ADD_MONTHS(TO_DATE(:startDate, \'YYYY-MM-DD\'), 1)', {
        startDate: `${month}-01`,
      })
      .orderBy('d.workDate', 'ASC')
      .getMany();

    return days.map((d) => {
      const raw = d.workDate;
      const dt = typeof raw === 'object' && raw !== null
        ? (raw as Date)
        : new Date(String(raw));
      return dt.toISOString().substring(0, 10);
    });
  }

  /**
   * 품목별 병목 CAPA를 조회한다 (MIN(dailyCapa) 기준).
   * CAPA 정보가 없는 품목은 기본 CAPA(9999)를 할당한다.
   */
  async loadBottleneckCapa(
    itemCodes: string[],
    company: string,
    plant: string,
  ): Promise<{ capaMap: Map<string, number>; processMap: Map<string, string> }> {
    const capaMap = new Map<string, number>();
    const processMap = new Map<string, string>();
    if (itemCodes.length === 0) return { capaMap, processMap };

    const rows: Array<{ itemCode: string; minCapa: number }> =
      await this.capaRepo
        .createQueryBuilder('c')
        .select('c.itemCode', 'itemCode')
        .addSelect('MIN(c.dailyCapa)', 'minCapa')
        .where('c.company = :company', { company })
        .andWhere('c.plant = :plant', { plant })
        .andWhere('c.useYn = :yn', { yn: 'Y' })
        .andWhere('c.itemCode IN (:...codes)', { codes: itemCodes })
        .groupBy('c.itemCode')
        .getRawMany();

    // 병목 CAPA에 해당하는 상세 레코드를 일괄 조회 (N+1 제거)
    const allCapas = await this.capaRepo.find({
      where: { company, plant, useYn: 'Y', itemCode: In(itemCodes) },
    });

    // 병목 공정코드 추출을 위한 맵
    const bottleneckDetails = new Map<string, typeof allCapas[number]>();
    for (const row of rows) {
      const dailyCapa = Number(row.minCapa) || 0;
      capaMap.set(row.itemCode, dailyCapa);
      const detail = allCapas.find(
        (c) => c.itemCode === row.itemCode && c.dailyCapa === dailyCapa,
      );
      if (detail) bottleneckDetails.set(row.itemCode, detail);
    }

    // 공정명 일괄 조회 (N+1 제거)
    const processCodes = [...new Set(
      [...bottleneckDetails.values()].map((d) => d.processCode).filter(Boolean),
    )];
    const processes = processCodes.length > 0
      ? await this.processRepo.find({ where: { processCode: In(processCodes) } })
      : [];
    const procNameMap = new Map(processes.map((p) => [p.processCode, p.processName]));

    for (const [itemCode, detail] of bottleneckDetails) {
      processMap.set(itemCode, procNameMap.get(detail.processCode) ?? detail.processCode);
    }

    const DEFAULT_CAPA = 9999;
    for (const code of itemCodes) {
      if (!capaMap.has(code)) {
        this.logger.warn(`CAPA 미등록 품목, 기본값 사용: ${code}`);
        capaMap.set(code, DEFAULT_CAPA);
        processMap.set(code, '-');
      }
    }

    return { capaMap, processMap };
  }

  /**
   * 품목별 전체 공정 CAPA를 순서대로 반환한다.
   * 라우팅 순서(sortOrder) 기준 정렬.
   */
  async loadAllProcessCapa(
    itemCodes: string[],
    company: string,
    plant: string,
  ): Promise<Map<string, ProcessCapaInfo[]>> {
    const result = new Map<string, ProcessCapaInfo[]>();
    if (itemCodes.length === 0) return result;

    // 전체 품목 CAPA 일괄 조회 (N+1 제거)
    const allCapas = await this.capaRepo.find({
      where: { company, plant, useYn: 'Y', itemCode: In(itemCodes) },
      order: { processCode: 'ASC' },
    });

    // 관련 공정 일괄 조회 (N+1 제거)
    const procCodes = [...new Set(allCapas.map((c) => c.processCode).filter(Boolean))];
    const allProcs = procCodes.length > 0
      ? await this.processRepo.find({ where: { processCode: In(procCodes) } })
      : [];
    const procMap = new Map(allProcs.map((p) => [p.processCode, p]));

    // 품목별 그룹핑
    for (const itemCode of itemCodes) {
      const capas = allCapas.filter((c) => c.itemCode === itemCode);
      const processes: ProcessCapaInfo[] = capas.map((c) => {
        const proc = procMap.get(c.processCode);
        return {
          processCode: c.processCode,
          processName: proc?.processName ?? c.processCode,
          dailyCapa: c.dailyCapa,
          setupTime: Number(c.setupTime) || 0,
          sortOrder: proc?.sortOrder ?? 999,
        };
      });
      processes.sort((a, b) => a.sortOrder - b.sortOrder);
      result.set(itemCode, processes);
    }

    return result;
  }

  /**
   * 계획별 납기일을 수주 데이터에서 조회한다.
   * plan.customer + plan.itemCode로 CustomerOrder/CustomerOrderItem을 매칭하여
   * 해당 월에 가장 빠른 납기일(MIN(DUE_DATE))을 반환한다.
   */
  async loadDueDates(
    plans: ProdPlan[],
    month: string,
    company: string,
    plant: string,
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();

    // 고유한 (customer, itemCode) 쌍 수집
    const pairs: Array<{ customer: string; itemCode: string }> = [];
    for (const p of plans) {
      if (p.customer) {
        const exists = pairs.some(
          (x) => x.customer === p.customer && x.itemCode === p.itemCode,
        );
        if (!exists) {
          pairs.push({ customer: p.customer, itemCode: p.itemCode });
        }
      }
    }

    if (pairs.length === 0) {
      plans.forEach((p) => map.set(p.planNo, null));
      return map;
    }

    // 각 (customer, itemCode) 쌍에 대해 납기일 조회
    const dueDateByKey = new Map<string, string>();
    for (const pair of pairs) {
      const result: Array<{ dueDate: string }> = await this.orderRepo
        .createQueryBuilder('co')
        .innerJoin(CustomerOrderItem, 'ci', 'co.orderNo = ci.orderNo')
        .select('MIN(co.dueDate)', 'dueDate')
        .where('co.customerId = :customerId', { customerId: pair.customer })
        .andWhere('ci.itemCode = :itemCode', { itemCode: pair.itemCode })
        .andWhere("TO_CHAR(co.dueDate, 'YYYY-MM') = :month", { month })
        .andWhere('co.company = :company', { company })
        .andWhere('co.plant = :plant', { plant })
        .getRawMany();

      if (result[0]?.dueDate) {
        const rawDue = result[0].dueDate;
        const dt = typeof rawDue === 'object' && rawDue !== null
          ? (rawDue as unknown as Date)
          : new Date(String(rawDue));
        dueDateByKey.set(
          `${pair.customer}|${pair.itemCode}`,
          dt.toISOString().substring(0, 10),
        );
      }
    }

    // 계획별로 매핑
    for (const p of plans) {
      const key = `${p.customer ?? ''}|${p.itemCode}`;
      map.set(p.planNo, dueDateByKey.get(key) ?? null);
    }

    return map;
  }

  /**
   * 반제품(WIP) 가용재고를 품목별로 합산 조회한다.
   * PRODUCT_STOCKS 테이블에서 itemType='WIP', status='NORMAL'인 availableQty를 합산한다.
   */
  async loadWipStock(
    itemCodes: string[],
    company: string,
    plant: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (itemCodes.length === 0) return map;

    const rows: Array<{ itemCode: string; totalAvail: string }> =
      await this.stockRepo
        .createQueryBuilder('s')
        .select('s.itemCode', 'itemCode')
        .addSelect('SUM(s.availableQty)', 'totalAvail')
        .where('s.company = :company', { company })
        .andWhere('s.plant = :plant', { plant })
        .andWhere('s.itemType = :type', { type: 'WIP' })
        .andWhere('s.status = :status', { status: 'NORMAL' })
        .andWhere('s.itemCode IN (:...codes)', { codes: itemCodes })
        .groupBy('s.itemCode')
        .getRawMany();

    for (const row of rows) {
      map.set(row.itemCode, Number(row.totalAvail) || 0);
    }

    return map;
  }

  /**
   * 고객ID -> 고객명 매핑을 조회한다.
   */
  async loadCustomerNames(
    plans: ProdPlan[],
    company: string,
    plant: string,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const customerIds = [
      ...new Set(plans.map((p) => p.customer).filter(Boolean)),
    ] as string[];

    if (customerIds.length === 0) return map;

    const rows: Array<{ customerId: string; customerName: string }> =
      await this.orderRepo
        .createQueryBuilder('co')
        .select('co.customerId', 'customerId')
        .addSelect('MAX(co.customerName)', 'customerName')
        .where('co.company = :company', { company })
        .andWhere('co.plant = :plant', { plant })
        .andWhere('co.customerId IN (:...ids)', { ids: customerIds })
        .groupBy('co.customerId')
        .getRawMany();

    for (const row of rows) {
      if (row.customerId) {
        map.set(row.customerId, row.customerName ?? row.customerId);
      }
    }

    return map;
  }
}
