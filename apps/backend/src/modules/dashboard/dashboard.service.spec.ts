/**
 * @file src/modules/dashboard/dashboard.service.spec.ts
 * @description DashboardService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - OracleService를 모킹하여 PKG_DASHBOARD 프로시저 호출 테스트
 * - 실행: `pnpm test -- -t "DashboardService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { OracleService } from '../../common/services/oracle.service';
import { MockLoggerService } from '../../common/test/mock-logger.service';

describe('DashboardService', () => {
  let target: DashboardService;
  let mockOracleService: {
    callProc: jest.Mock;
    callProcMultiCursor: jest.Mock;
  };

  beforeEach(async () => {
    mockOracleService = {
      callProc: jest.fn(),
      callProcMultiCursor: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: OracleService, useValue: mockOracleService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getSummary ───
  describe('getSummary', () => {
    it('should return combined summary data', async () => {
      // Arrange
      mockOracleService.callProc
        .mockResolvedValueOnce([{ normalCnt: 5, maintCnt: 1, stopCnt: 0, totalCnt: 6 }]) // equip
        .mockResolvedValueOnce([{ waitCnt: 2, runningCnt: 3, doneCnt: 1, totalCnt: 6 }]) // job
        .mockResolvedValueOnce([{ lowStockCnt: 1, nearExpiryCnt: 0, expiredCnt: 0 }]) // mat
        .mockResolvedValueOnce([{ waitCnt: 0, repairCnt: 0, reworkCnt: 0, doneCnt: 0, totalCnt: 0 }]); // defect

      mockOracleService.callProcMultiCursor
        .mockResolvedValueOnce({ o_summary: [{ totalCnt: 10, completedCnt: 8, passCnt: 7, failCnt: 1 }], o_items: [] }) // daily
        .mockResolvedValueOnce({ o_summary: [{ totalCnt: 5, completedCnt: 5, passCnt: 5, failCnt: 0 }], o_items: [] }) // periodic
        .mockResolvedValueOnce({ o_summary: [{ totalCnt: 3, completedCnt: 2, passCnt: 2, failCnt: 0 }], o_items: [] }); // pm

      // Act
      const result = await target.getSummary('2026-03-18');

      // Assert
      expect(result.equip).toEqual({ normal: 5, maint: 1, stop: 0, total: 6 });
      expect(result.job).toEqual({ wait: 2, running: 3, done: 1, total: 6 });
      expect(result.mat).toEqual({ lowStock: 1, nearExpiry: 0, expired: 0 });
      expect(result.daily.total).toBe(10);
    });

    it('should handle empty rows gracefully', async () => {
      // Arrange
      mockOracleService.callProc.mockResolvedValue([]);
      mockOracleService.callProcMultiCursor.mockResolvedValue({ o_summary: [], o_items: [] });

      // Act
      const result = await target.getSummary('2026-03-18');

      // Assert
      expect(result.equip).toEqual({ normal: 0, maint: 0, stop: 0, total: 0 });
      expect(result.job).toEqual({ wait: 0, running: 0, done: 0, total: 0 });
    });
  });

  // ─── getKpi ───
  describe('getKpi', () => {
    it('should return KPI data', async () => {
      // Arrange
      mockOracleService.callProc.mockResolvedValue([{
        todayProd: 100,
        prodChange: 5,
        inventoryTotal: 500,
        invChange: -2,
        passRate: '98.5',
        rateChange: 0.5,
        defectCnt: 3,
        defectChange: -1,
      }]);

      // Act
      const result = await target.getKpi();

      // Assert
      expect(result.todayProduction).toEqual({ value: 100, change: 5 });
      expect(result.qualityPassRate).toEqual({ value: '98.5', change: 0.5 });
    });

    it('should handle empty KPI result', async () => {
      // Arrange
      mockOracleService.callProc.mockResolvedValue([]);

      // Act
      const result = await target.getKpi();

      // Assert
      expect(result.todayProduction).toEqual({ value: 0, change: 0 });
    });
  });

  // ─── getRecentProductions ───
  describe('getRecentProductions', () => {
    it('should return recent productions from Oracle', async () => {
      // Arrange
      const productions = [{ orderNo: 'ORD1', itemCode: 'ITEM1' }];
      mockOracleService.callProc.mockResolvedValue(productions);

      // Act
      const result = await target.getRecentProductions();

      // Assert
      expect(result).toEqual(productions);
    });
  });
});
