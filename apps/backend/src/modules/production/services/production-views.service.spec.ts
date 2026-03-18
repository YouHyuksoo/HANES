/**
 * @file src/modules/production/services/production-views.service.spec.ts
 * @description ProductionViewsService 단위 테스트 - 조회 전용 서비스 검증
 *
 * 초보자 가이드:
 * - 조회 전용이므로 주로 QueryBuilder 모킹 검증
 * - 실행: `npx jest --testPathPattern="production-views.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionViewsService } from './production-views.service';
import { JobOrder } from '../../../entities/job-order.entity';
import { InspectResult } from '../../../entities/inspect-result.entity';
import { BoxMaster } from '../../../entities/box-master.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ProductionViewsService', () => {
  let target: ProductionViewsService;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockInspectResultRepo: DeepMocked<Repository<InspectResult>>;
  let mockBoxMasterRepo: DeepMocked<Repository<BoxMaster>>;
  let mockStockRepo: DeepMocked<Repository<MatStock>>;

  beforeEach(async () => {
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockInspectResultRepo = createMock<Repository<InspectResult>>();
    mockBoxMasterRepo = createMock<Repository<BoxMaster>>();
    mockStockRepo = createMock<Repository<MatStock>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionViewsService,
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: getRepositoryToken(InspectResult), useValue: mockInspectResultRepo },
        { provide: getRepositoryToken(BoxMaster), useValue: mockBoxMasterRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockStockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProductionViewsService>(ProductionViewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // getProgress
  // ─────────────────────────────────────────────
  describe('getProgress', () => {
    it('should return paginated progress data', async () => {
      // Arrange
      const data = [{ orderNo: 'JO-001' }] as JobOrder[];
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(data),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockJobOrderRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.getProgress({ page: 1, limit: 20 } as any);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should apply status filter', async () => {
      // Arrange
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockJobOrderRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await target.getProgress({ page: 1, limit: 20, status: 'RUNNING' } as any);

      // Assert
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'jo.status = :status',
        { status: 'RUNNING' },
      );
    });
  });

  // ─────────────────────────────────────────────
  // getSampleInspect
  // ─────────────────────────────────────────────
  describe('getSampleInspect', () => {
    it('should return paginated sample inspect data', async () => {
      // Arrange
      const data = [{ id: 1 }];
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(data),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockInspectResultRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.getSampleInspect({ page: 1, limit: 10 } as any);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // getPackResult
  // ─────────────────────────────────────────────
  describe('getPackResult', () => {
    it('should return paginated pack results without search', async () => {
      // Arrange
      const data = [{ boxNo: 'BOX-001' }] as any;
      mockBoxMasterRepo.find.mockResolvedValue(data);
      mockBoxMasterRepo.count.mockResolvedValue(1);

      // Act
      const result = await target.getPackResult({ page: 1, limit: 10 } as any);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should use queryBuilder when search is provided', async () => {
      // Arrange
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
      };
      mockBoxMasterRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.getPackResult({
        page: 1, limit: 10, search: 'BOX',
      } as any);

      // Assert
      expect(result.data).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // getWipStock
  // ─────────────────────────────────────────────
  describe('getWipStock', () => {
    it('should return WIP/FG stock data', async () => {
      // Arrange
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ itemCode: 'WIP-001' }]),
        getCount: jest.fn().mockResolvedValue(1),
      };
      mockStockRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.getWipStock({ page: 1, limit: 10 } as any);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
