/**
 * @file src/modules/monitoring/services/production-board.service.ts
 * @description 생산현황 보드(TV) 집계 서비스 — 오늘 지시일 작업지시 + 시간대별 실적
 *
 * 초보자 가이드:
 * 1. 모든 집계는 DB GROUP BY 로 수행한다 (N+1·메모리 집계 금지)
 * 2. "오늘" 기준은 Oracle TRUNC(SYSDATE) — 서버 로컬 날짜 (UTC 변환 금지)
 * 3. 작업지시 칸반 보드도 이 API 의 orders 를 status 별로 그룹핑해 재사용한다
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobOrder } from '../../../entities/job-order.entity';
import { ProdResult } from '../../../entities/prod-result.entity';

export interface ProductionBoardOrder {
  orderNo: string;
  itemCode: string;
  itemName: string | null;
  processCode: string | null;
  equipCode: string | null;
  status: string;
  planQty: number;
  goodQty: number;
  defectQty: number;
  achieveRate: number;
}

interface OrderRaw {
  orderNo: string;
  itemCode: string;
  itemName: string | null;
  processCode: string | null;
  equipCode: string | null;
  status: string;
  planQty: string | number;
  goodQty: string | number;
  defectQty: string | number;
}

interface HourlyRaw {
  hour: string;
  goodQty: string | number;
  defectQty: string | number;
}

@Injectable()
export class ProductionBoardService {
  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(ProdResult)
    private readonly prodResultRepository: Repository<ProdResult>,
  ) {}

  /** 오늘 지시일 작업지시 전체(CANCELED 제외) + KPI + 시간대별 실적 */
  async getBoard(company?: string, plant?: string) {
    const [orders, hourly] = await Promise.all([
      this.getTodayOrders(company, plant),
      this.getHourlyResults(company, plant),
    ]);

    const kpi = {
      planQty: orders.reduce((s, o) => s + o.planQty, 0),
      goodQty: orders.reduce((s, o) => s + o.goodQty, 0),
      defectQty: orders.reduce((s, o) => s + o.defectQty, 0),
      achieveRate: 0,
      runningCount: orders.filter((o) => o.status === 'RUNNING').length,
      totalCount: orders.length,
    };
    kpi.achieveRate = kpi.planQty > 0 ? Math.round((kpi.goodQty / kpi.planQty) * 1000) / 10 : 0;

    return { kpi, orders, hourly };
  }

  private async getTodayOrders(company?: string, plant?: string): Promise<ProductionBoardOrder[]> {
    const qb = this.jobOrderRepository
      .createQueryBuilder('jo')
      .leftJoin('jo.part', 'p')
      .select([
        'jo.orderNo AS "orderNo"',
        'jo.itemCode AS "itemCode"',
        'p.itemName AS "itemName"',
        'jo.processCode AS "processCode"',
        'jo.equipCode AS "equipCode"',
        'jo.status AS "status"',
        'jo.planQty AS "planQty"',
        'jo.goodQty AS "goodQty"',
        'jo.defectQty AS "defectQty"',
      ])
      .where('jo.planDate >= TRUNC(SYSDATE)')
      .andWhere('jo.planDate < TRUNC(SYSDATE) + 1')
      .andWhere("jo.status != 'CANCELED'")
      .orderBy(
        "CASE jo.status WHEN 'RUNNING' THEN 0 WHEN 'HOLD' THEN 1 WHEN 'WAITING' THEN 2 ELSE 3 END",
        'ASC',
      )
      .addOrderBy('jo.priority', 'ASC')
      .addOrderBy('jo.orderNo', 'ASC');

    if (company) qb.andWhere('jo.company = :company', { company });
    if (plant) qb.andWhere('jo.plant = :plant', { plant });

    const rows = await qb.getRawMany<OrderRaw>();
    return rows.map((r) => {
      const planQty = Number(r.planQty ?? 0);
      const goodQty = Number(r.goodQty ?? 0);
      return {
        orderNo: r.orderNo,
        itemCode: r.itemCode,
        itemName: r.itemName ?? null,
        processCode: r.processCode ?? null,
        equipCode: r.equipCode ?? null,
        status: r.status,
        planQty,
        goodQty,
        defectQty: Number(r.defectQty ?? 0),
        achieveRate: planQty > 0 ? Math.round((goodQty / planQty) * 1000) / 10 : 0,
      };
    });
  }

  /** 오늘 실적을 시간대(00~23)별 합산 */
  private async getHourlyResults(company?: string, plant?: string) {
    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select([
        "TO_CHAR(pr.createdAt, 'HH24') AS \"hour\"",
        'SUM(pr.goodQty) AS "goodQty"',
        'SUM(pr.defectQty) AS "defectQty"',
      ])
      .where('pr.createdAt >= TRUNC(SYSDATE)')
      .andWhere('pr.createdAt < TRUNC(SYSDATE) + 1')
      .groupBy("TO_CHAR(pr.createdAt, 'HH24')")
      .orderBy('"hour"', 'ASC');

    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });

    const rows = await qb.getRawMany<HourlyRaw>();
    return rows.map((r) => ({
      hour: r.hour,
      goodQty: Number(r.goodQty ?? 0),
      defectQty: Number(r.defectQty ?? 0),
    }));
  }
}
