/**
 * @file src/modules/production/services/sample-inspect.service.spec.ts
 * @description SampleInspectService 단위 테스트 - 샘플검사 입력/조회 로직 검증
 *
 * 초보자 가이드:
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - 트랜잭션 로직(create)과 조회 로직(findHistory, findByJobOrder)을 검증
 * - 실행: `npx jest --testPathPattern="sample-inspect.service.spec"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { SampleInspectService } from './sample-inspect.service';
import { SampleInspectResult } from '../../../entities/sample-inspect-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('SampleInspectService', () => {
  let target: SampleInspectService;
  let mockSampleInspectRepo: DeepMocked<Repository<SampleInspectResult>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockSampleInspectRepo = createMock<Repository<SampleInspectResult>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SampleInspectService,
        { provide: getRepositoryToken(SampleInspectResult), useValue: mockSampleInspectRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<SampleInspectService>(SampleInspectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    const createDto = {
      orderNo: 'JO-001',
      inspectDate: '2026-03-18',
      inspectorName: '홍길동',
      inspectType: 'DIMENSION',
      samples: [
        { sampleNo: 1, measuredValue: 10.5, specUpper: 11, specLower: 10, passYn: 'Y' },
        { sampleNo: 2, measuredValue: 9.8, specUpper: 11, specLower: 10, passYn: 'N' },
      ],
    } as any;

    it('should create sample inspect records in transaction', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001', company: 'COMP', plant: 'PLT',
      } as any);
      const entities = createDto.samples.map((s: any) => ({ ...s, orderNo: 'JO-001' }));
      mockQueryRunner.manager.create.mockImplementation((_: any, data: any) => data);
      mockQueryRunner.manager.save.mockResolvedValue(entities);

      // Act
      const result = await target.create(createDto);

      // Assert
      expect(result.count).toBe(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw NotFoundException when job order not found', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should rollback on error', async () => {
      // Arrange
      mockJobOrderRepo.findOne.mockResolvedValue({
        orderNo: 'JO-001', company: 'C', plant: 'P',
      } as any);
      mockQueryRunner.manager.create.mockImplementation((_: any, data: any) => data);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(target.create(createDto)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // findHistory
  // ─────────────────────────────────────────────
  describe('findHistory', () => {
    it('should return sample inspect history', async () => {
      // Arrange
      const data = [{ orderNo: 'JO-001', sampleNo: 1 }];
      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(data),
      };
      mockSampleInspectRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      const result = await target.findHistory({ limit: 50 } as any);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply passYn filter', async () => {
      // Arrange
      const mockQb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockSampleInspectRepo.createQueryBuilder.mockReturnValue(mockQb as any);

      // Act
      await target.findHistory({ limit: 50, passYn: 'N' } as any);

      // Assert
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'si.passYn = :passYn', { passYn: 'N' },
      );
    });
  });

  // ─────────────────────────────────────────────
  // findByJobOrder
  // ─────────────────────────────────────────────
  describe('findByJobOrder', () => {
    it('should return sample inspects for job order', async () => {
      // Arrange
      const data = [
        { orderNo: 'JO-001', sampleNo: 1 },
        { orderNo: 'JO-001', sampleNo: 2 },
      ] as SampleInspectResult[];
      mockSampleInspectRepo.find.mockResolvedValue(data);

      // Act
      const result = await target.findByJobOrder('JO-001');

      // Assert
      expect(result).toHaveLength(2);
      expect(mockSampleInspectRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderNo: 'JO-001' } }),
      );
    });
  });
});
