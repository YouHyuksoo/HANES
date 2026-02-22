/**
 * @file src/modules/dashboard/dashboard.service.ts
 * @description 대시보드 서비스 - KPI 집계 및 최근 생산 현황 조회
 *
 * 초보자 가이드:
 * 1. **getKpi()**: 오늘/어제 기준 생산량·재고·품질·불량 비교
 * 2. **getRecentProductions()**: 최근 작업지시 10건 (품목명, 라인, 진행률 포함)
 *
 * 쿼리 전략:
 * - Oracle DB 기준 TRUNC(SYSDATE) 사용하여 오늘/어제 필터
 * - NVL 함수로 NULL 안전 처리
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobOrder } from '../../entities/job-order.entity';
import { MatStock } from '../../entities/mat-stock.entity';
import { InspectResult } from '../../entities/inspect-result.entity';
import { DefectLog } from '../../entities/defect-log.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(MatStock)
    private readonly matStockRepo: Repository<MatStock>,
    @InjectRepository(InspectResult)
    private readonly inspectResultRepo: Repository<InspectResult>,
    @InjectRepository(DefectLog)
    private readonly defectLogRepo: Repository<DefectLog>,
  ) {}

  /**
   * KPI 데이터 조회
   * - todayProduction: 오늘 계획일 기준 양품 합계 + 전일 대비 변화율
   * - inventoryStatus: 현재 총 재고수량 + 전일 대비 변화율
   * - qualityPassRate: 오늘 검사 합격률 + 전일 대비 변화율
   * - interlockCount: 오늘 불량 건수 + 전일 대비 변화율
   */
  async getKpi() {
    const [todayProduction, inventoryStatus, qualityPassRate, interlockCount] =
      await Promise.all([
        this.getTodayProduction(),
        this.getInventoryStatus(),
        this.getQualityPassRate(),
        this.getInterlockCount(),
      ]);

    return { todayProduction, inventoryStatus, qualityPassRate, interlockCount };
  }

  /**
   * 최근 작업지시 10건 조회
   */
  async getRecentProductions() {
    const orders = await this.jobOrderRepo
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'part')
      .orderBy('jo.createdAt', 'DESC')
      .take(10)
      .getMany();

    return orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      partName: o.part?.partName ?? '-',
      line: o.lineCode ?? '-',
      planQty: o.planQty,
      actualQty: o.goodQty,
      progress: o.planQty > 0 ? Math.round((o.goodQty / o.planQty) * 1000) / 10 : 0,
      status: o.status === 'WAITING' ? 'WAIT' : o.status,
    }));
  }

  /** 오늘 생산량 (양품 합계) + 전일 대비 변화율 */
  private async getTodayProduction() {
    const todayResult = await this.jobOrderRepo
      .createQueryBuilder('jo')
      .select('NVL(SUM(jo.GOOD_QTY), 0)', 'total')
      .where('TRUNC(jo.PLAN_DATE) = TRUNC(SYSDATE)')
      .getRawOne();

    const yesterdayResult = await this.jobOrderRepo
      .createQueryBuilder('jo')
      .select('NVL(SUM(jo.GOOD_QTY), 0)', 'total')
      .where('TRUNC(jo.PLAN_DATE) = TRUNC(SYSDATE) - 1')
      .getRawOne();

    const todayVal = Number(todayResult?.total ?? 0);
    const yesterdayVal = Number(yesterdayResult?.total ?? 0);
    const change = yesterdayVal > 0
      ? Math.round(((todayVal - yesterdayVal) / yesterdayVal) * 100)
      : 0;

    return { value: todayVal, change };
  }

  /** 현재 총 재고수량 + 전일 대비 변화율 */
  private async getInventoryStatus() {
    const stockResult = await this.matStockRepo
      .createQueryBuilder('s')
      .select('NVL(SUM(s.QTY), 0)', 'total')
      .getRawOne();

    const totalQty = Number(stockResult?.total ?? 0);

    return { value: totalQty, change: 0 };
  }

  /** 오늘 검사 합격률 + 전일 대비 변화율 */
  private async getQualityPassRate() {
    const todayResult = await this.inspectResultRepo
      .createQueryBuilder('ir')
      .select('COUNT(*)', 'total')
      .addSelect("SUM(CASE WHEN ir.PASS_YN = 'Y' THEN 1 ELSE 0 END)", 'passCount')
      .where('TRUNC(ir.INSPECT_TIME) = TRUNC(SYSDATE)')
      .getRawOne();

    const yesterdayResult = await this.inspectResultRepo
      .createQueryBuilder('ir')
      .select('COUNT(*)', 'total')
      .addSelect("SUM(CASE WHEN ir.PASS_YN = 'Y' THEN 1 ELSE 0 END)", 'passCount')
      .where('TRUNC(ir.INSPECT_TIME) = TRUNC(SYSDATE) - 1')
      .getRawOne();

    const todayTotal = Number(todayResult?.total ?? 0);
    const todayPass = Number(todayResult?.passCount ?? 0);
    const yesterdayTotal = Number(yesterdayResult?.total ?? 0);
    const yesterdayPass = Number(yesterdayResult?.passCount ?? 0);

    const todayRate = todayTotal > 0 ? (todayPass / todayTotal) * 100 : 100;
    const yesterdayRate = yesterdayTotal > 0 ? (yesterdayPass / yesterdayTotal) * 100 : 100;
    const change = Math.round((todayRate - yesterdayRate) * 10) / 10;

    return { value: todayRate.toFixed(1), change };
  }

  /** 오늘 불량 건수 + 전일 대비 변화율 */
  private async getInterlockCount() {
    const todayResult = await this.defectLogRepo
      .createQueryBuilder('d')
      .select('COUNT(*)', 'total')
      .where('TRUNC(d.OCCUR_TIME) = TRUNC(SYSDATE)')
      .getRawOne();

    const yesterdayResult = await this.defectLogRepo
      .createQueryBuilder('d')
      .select('COUNT(*)', 'total')
      .where('TRUNC(d.OCCUR_TIME) = TRUNC(SYSDATE) - 1')
      .getRawOne();

    const todayVal = Number(todayResult?.total ?? 0);
    const yesterdayVal = Number(yesterdayResult?.total ?? 0);
    const change = yesterdayVal > 0
      ? Math.round(((todayVal - yesterdayVal) / yesterdayVal) * 100)
      : 0;

    return { value: todayVal, change };
  }
}
