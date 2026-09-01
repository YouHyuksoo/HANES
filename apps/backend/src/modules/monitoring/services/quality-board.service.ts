/**
 * @file src/modules/monitoring/services/quality-board.service.ts
 * @description 품질 모니터링 보드 집계 서비스 — 오늘 불량률/공정별/유형별 TOP/수리 현황/7일 추이
 *
 * 초보자 가이드:
 * 1. 불량률 = SUM(DEFECT_QTY) / SUM(GOOD_QTY + DEFECT_QTY) — PROD_RESULTS 기준
 * 2. 불량유형 TOP 은 DEFECT_LOGS 를 DEFECT_CODE 로 GROUP BY
 * 3. 수리 현황은 REPAIR_ORDERS 상태(RECEIVED/IN_REPAIR/COMPLETED) 집계
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProdResult } from '../../../entities/prod-result.entity';
import { DefectLog } from '../../../entities/defect-log.entity';
import { RepairOrder } from '../../../entities/repair-order.entity';

interface ProcessRaw {
  processCode: string | null;
  totalQty: string | number;
  defectQty: string | number;
}

interface TopDefectRaw {
  defectCode: string;
  defectName: string | null;
  qty: string | number;
}

interface RepairRaw {
  received: string | number;
  inRepair: string | number;
  completedToday: string | number;
}

interface DailyRaw {
  ymd: string;
  totalQty: string | number;
  defectQty: string | number;
}

function rate(defect: number, total: number): number {
  return total > 0 ? Math.round((defect / total) * 1000) / 10 : 0;
}

@Injectable()
export class QualityBoardService {
  constructor(
    @InjectRepository(ProdResult)
    private readonly prodResultRepository: Repository<ProdResult>,
    @InjectRepository(DefectLog)
    private readonly defectLogRepository: Repository<DefectLog>,
    @InjectRepository(RepairOrder)
    private readonly repairOrderRepository: Repository<RepairOrder>,
  ) {}

  async getBoard(company?: string, plant?: string) {
    const [byProcess, topDefects, repair, dailyTrend] = await Promise.all([
      this.getByProcess(company, plant),
      this.getTopDefects(company, plant),
      this.getRepairStatus(company, plant),
      this.getDailyTrend(company, plant),
    ]);

    const totalQty = byProcess.reduce((s, p) => s + p.totalQty, 0);
    const defectQty = byProcess.reduce((s, p) => s + p.defectQty, 0);
    const kpi = { totalQty, defectQty, defectRate: rate(defectQty, totalQty) };

    return { kpi, byProcess, topDefects, repair, dailyTrend };
  }

  /** 오늘 공정별 생산량/불량량 */
  private async getByProcess(company?: string, plant?: string) {
    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select([
        'pr.processCode AS "processCode"',
        'SUM(pr.goodQty + pr.defectQty) AS "totalQty"',
        'SUM(pr.defectQty) AS "defectQty"',
      ])
      .where('pr.createdAt >= TRUNC(SYSDATE)')
      .andWhere('pr.createdAt < TRUNC(SYSDATE) + 1')
      .groupBy('pr.processCode')
      .orderBy('"defectQty"', 'DESC');

    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });

    const rows = await qb.getRawMany<ProcessRaw>();
    return rows.map((r) => {
      const totalQty = Number(r.totalQty ?? 0);
      const defectQty = Number(r.defectQty ?? 0);
      return {
        processCode: r.processCode ?? '-',
        totalQty,
        defectQty,
        defectRate: rate(defectQty, totalQty),
      };
    });
  }

  /** 오늘 불량유형 TOP 10 */
  private async getTopDefects(company?: string, plant?: string) {
    const qb = this.defectLogRepository
      .createQueryBuilder('dl')
      .select([
        'dl.defectCode AS "defectCode"',
        'MAX(dl.defectName) AS "defectName"',
        'SUM(dl.qty) AS "qty"',
      ])
      .where('dl.occurAt >= TRUNC(SYSDATE)')
      .andWhere('dl.occurAt < TRUNC(SYSDATE) + 1')
      .groupBy('dl.defectCode')
      .orderBy('"qty"', 'DESC')
      .limit(10);

    if (company) qb.andWhere('dl.company = :company', { company });
    if (plant) qb.andWhere('dl.plant = :plant', { plant });

    const rows = await qb.getRawMany<TopDefectRaw>();
    return rows.map((r) => ({
      defectCode: r.defectCode,
      defectName: r.defectName ?? r.defectCode,
      qty: Number(r.qty ?? 0),
    }));
  }

  /** 수리 대기(RECEIVED)/수리중(IN_REPAIR)/금일 완료(COMPLETED) 건수 — 조건부 집계 1쿼리 */
  private async getRepairStatus(company?: string, plant?: string) {
    const qb = this.repairOrderRepository
      .createQueryBuilder('ro')
      .select([
        "SUM(CASE WHEN ro.status = 'RECEIVED' THEN 1 ELSE 0 END) AS \"received\"",
        "SUM(CASE WHEN ro.status = 'IN_REPAIR' THEN 1 ELSE 0 END) AS \"inRepair\"",
        "SUM(CASE WHEN ro.status = 'COMPLETED' AND ro.updatedAt >= TRUNC(SYSDATE) THEN 1 ELSE 0 END) AS \"completedToday\"",
      ]);

    if (company) qb.andWhere('ro.company = :company', { company });
    if (plant) qb.andWhere('ro.plant = :plant', { plant });

    const row = await qb.getRawOne<RepairRaw>();
    return {
      received: Number(row?.received ?? 0),
      inRepair: Number(row?.inRepair ?? 0),
      completedToday: Number(row?.completedToday ?? 0),
    };
  }

  /** 최근 7일 일별 불량률 추이 */
  private async getDailyTrend(company?: string, plant?: string) {
    const qb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select([
        "TO_CHAR(pr.createdAt, 'YYYY-MM-DD') AS \"ymd\"",
        'SUM(pr.goodQty + pr.defectQty) AS "totalQty"',
        'SUM(pr.defectQty) AS "defectQty"',
      ])
      .where('pr.createdAt >= TRUNC(SYSDATE) - 6')
      .groupBy("TO_CHAR(pr.createdAt, 'YYYY-MM-DD')")
      .orderBy('"ymd"', 'ASC');

    if (company) qb.andWhere('pr.company = :company', { company });
    if (plant) qb.andWhere('pr.plant = :plant', { plant });

    const rows = await qb.getRawMany<DailyRaw>();
    return rows.map((r) => {
      const totalQty = Number(r.totalQty ?? 0);
      const defectQty = Number(r.defectQty ?? 0);
      return { date: r.ymd, totalQty, defectQty, defectRate: rate(defectQty, totalQty) };
    });
  }
}
