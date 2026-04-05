/**
 * @file src/modules/dashboard/dashboard.service.ts
 * @description 대시보드 서비스 — PKG_DASHBOARD Oracle 패키지 호출
 *
 * 초보자 가이드:
 * 1. OracleService.callProc()로 PKG_DASHBOARD 패키지의 프로시저를 호출
 * 2. callProcMultiCursor()로 다중 커서(요약+아이템) 반환 프로시저 호출
 * 3. 기존 API 응답 구조를 그대로 유지하여 프론트엔드 변경 없음
 *
 * 패키지 프로시저 목록:
 * - SP_EQUIP_STATS: 설비 상태별 카운트
 * - SP_JOB_ORDER_STATS: 작업지시 상태별 카운트
 * - SP_MAT_ALERT: 자재 알림 (안전재고/유효기한)
 * - SP_DEFECT_STATS: 불량 상태별 카운트
 * - SP_INSPECT_DAILY: 일상점검 요약 + 설비별 결과
 * - SP_INSPECT_PERIODIC: 정기점검 요약 + 설비별 결과
 * - SP_INSPECT_PM: 예방보전 요약 + 설비별 결과
 * - SP_KPI: KPI 4대 지표
 * - SP_RECENT_PRODUCTIONS: 최근 작업지시 10건
 */
import { Injectable } from '@nestjs/common';
import { OracleService } from '../../common/services/oracle.service';

const PKG = 'PKG_DASHBOARD';

@Injectable()
export class DashboardService {
  constructor(private readonly oracle: OracleService) {}

  /**
   * 대시보드 요약 데이터 (현황판 전용)
   * 기존 API 응답 구조 유지: { equip, job, mat, defect, daily, periodic, pm }
   */
  async getSummary(dateStr: string) {
    // 'T00:00:00' 을 붙여 로컬 타임존 자정 생성 (UTC 변환 방지)
    const targetDate = new Date(dateStr + 'T00:00:00');

    const [equip, job, mat, defect, daily, periodic, pm] = await Promise.all([
      this.getEquipStats(),
      this.getJobOrderStats(targetDate),
      this.getMatAlert(),
      this.getDefectStats(),
      this.getInspectData('SP_INSPECT_DAILY', targetDate),
      this.getInspectData('SP_INSPECT_PERIODIC', targetDate),
      this.getInspectData('SP_INSPECT_PM', targetDate),
    ]);

    return { equip, job, mat, defect, daily, periodic, pm };
  }

  /** KPI 데이터 (생산량/재고/합격률/불량) */
  async getKpi() {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_KPI');
    const r = rows[0] || {};
    return {
      todayProduction: { value: r.todayProd ?? 0, change: r.prodChange ?? 0 },
      inventoryStatus: { value: r.inventoryTotal ?? 0, change: r.invChange ?? 0 },
      qualityPassRate: { value: r.passRate ?? '100.0', change: r.rateChange ?? 0 },
      interlockCount: { value: r.defectCnt ?? 0, change: r.defectChange ?? 0 },
    };
  }

  /**
   * 최근 작업지시 10건
   * SP_RECENT_PRODUCTIONS에서 LINE_CODE→LINE alias, progress 계산,
   * WAITING→WAIT 상태 매핑을 PL/SQL에서 처리하므로 그대로 반환
   */
  async getRecentProductions() {
    return this.oracle.callProc<any>(PKG, 'SP_RECENT_PRODUCTIONS');
  }

  private async getEquipStats() {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_EQUIP_STATS');
    const r = rows[0] || {};
    return {
      normal: r.normalCnt ?? 0,
      maint: r.maintCnt ?? 0,
      stop: r.stopCnt ?? 0,
      total: r.totalCnt ?? 0,
    };
  }

  private async getJobOrderStats(date: Date) {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_JOB_ORDER_STATS', {
      p_target_date: date,
    });
    const r = rows[0] || {};
    return {
      wait: r.waitCnt ?? 0,
      running: r.runningCnt ?? 0,
      done: r.doneCnt ?? 0,
      total: r.totalCnt ?? 0,
    };
  }

  private async getMatAlert() {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_MAT_ALERT');
    const r = rows[0] || {};
    return {
      lowStock: r.lowStockCnt ?? 0,
      nearExpiry: r.nearExpiryCnt ?? 0,
      expired: r.expiredCnt ?? 0,
    };
  }

  private async getDefectStats() {
    const rows = await this.oracle.callProc<any>(PKG, 'SP_DEFECT_STATS');
    const r = rows[0] || {};
    return {
      wait: r.waitCnt ?? 0,
      repair: r.repairCnt ?? 0,
      rework: r.reworkCnt ?? 0,
      done: r.doneCnt ?? 0,
      total: r.totalCnt ?? 0,
    };
  }

  /**
   * 점검 데이터 조회 (일상/정기/PM 공통)
   * 다중 커서: o_summary (요약 1행) + o_items (설비별 행)
   */
  private async getInspectData(procName: string, date: Date) {
    const result = await this.oracle.callProcMultiCursor<any>(
      PKG,
      procName,
      ['o_summary', 'o_items'],
      { p_target_date: date },
    );

    const summary = result.o_summary[0] || {};
    const items = result.o_items || [];

    return {
      total: summary.totalCnt ?? 0,
      completed: summary.completedCnt ?? 0,
      pass: summary.passCnt ?? 0,
      fail: summary.failCnt ?? 0,
      items: items.map((item: any) => ({
        equipCode: item.equipCode ?? '',
        equipName: item.equipName ?? '',
        result: item.result ?? null,
        inspectorName: item.inspectorName ?? null,
        lineCode: item.lineCode ?? null,
      })),
    };
  }
}
