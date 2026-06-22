/**
 * @file inspect-result.service.spec.ts
 * @description InspectResultService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InspectResultService } from './inspect-result.service';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { TraceLog } from '../../../../entities/trace-log.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('InspectResultService', () => {
  let target: InspectResultService;
  let mockInspectRepo: DeepMocked<Repository<InspectResult>>;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockTraceLogRepo: DeepMocked<Repository<TraceLog>>;
  let mockSeqGen: DeepMocked<SeqGeneratorService>;

  beforeEach(async () => {
    mockInspectRepo = createMock<Repository<InspectResult>>();
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockTraceLogRepo = createMock<Repository<TraceLog>>();
    mockSeqGen = createMock<SeqGeneratorService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectResultService,
        { provide: getRepositoryToken(InspectResult), useValue: mockInspectRepo },
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: getRepositoryToken(TraceLog), useValue: mockTraceLogRepo },
        { provide: SeqGeneratorService, useValue: mockSeqGen },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<InspectResultService>(InspectResultService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return inspect result', async () => {
      mockInspectRepo.findOne.mockResolvedValue({ resultNo: 'IR-001' } as any);
      expect((await target.findById('IR-001')).resultNo).toBe('IR-001');
    });
    it('should throw NotFoundException', async () => {
      mockInspectRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
    it('should find inspect result within tenant only', async () => {
      mockInspectRepo.findOne.mockResolvedValue({ resultNo: 'IR-001', company: 'C1', plant: 'P1' } as any);

      await target.findById('IR-001', 'C1', 'P1');

      expect(mockInspectRepo.findOne).toHaveBeenCalledWith({
        where: { resultNo: 'IR-001', company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('findBySerialNo', () => {
    it('should find serial inspection history within tenant only', async () => {
      mockInspectRepo.find.mockResolvedValue([]);

      await target.findBySerialNo('SER-001', 'C1', 'P1');

      expect(mockInspectRepo.find).toHaveBeenCalledWith({
        where: { serialNo: 'SER-001', company: 'C1', plant: 'P1' },
        order: { inspectAt: 'DESC' },
      });
    });
  });

  describe('findByProdResultNo', () => {
    it('should find production result inspection history within tenant only', async () => {
      mockInspectRepo.find.mockResolvedValue([]);

      await target.findByProdResultNo('PR-001', 'C1', 'P1');

      expect(mockInspectRepo.find).toHaveBeenCalledWith({
        where: { prodResultNo: 'PR-001', company: 'C1', plant: 'P1' },
        order: { inspectAt: 'ASC' },
      });
    });
  });

  describe('create', () => {
    it('should create inspect result', async () => {
      mockProdResultRepo.findOne.mockResolvedValue({ id: 1 } as any);
      mockSeqGen.getNo.mockResolvedValue('IR-001');
      const saved = { resultNo: 'IR-001', passYn: 'Y' } as any;
      mockInspectRepo.create.mockReturnValue(saved);
      mockInspectRepo.save.mockResolvedValue(saved);
      const r = await target.create({ prodResultNo: '1', passYn: 'Y' } as any);
      expect(r.passYn).toBe('Y');
    });
    it('should validate production result within tenant only', async () => {
      mockProdResultRepo.findOne.mockResolvedValue({ resultNo: 'PR-001', company: 'C1', plant: 'P1' } as any);
      mockSeqGen.getNo.mockResolvedValue('IR-001');
      const saved = { resultNo: 'IR-001', passYn: 'Y', company: 'C1', plant: 'P1' } as any;
      mockInspectRepo.create.mockReturnValue(saved);
      mockInspectRepo.save.mockResolvedValue(saved);

      await target.create({ prodResultNo: 'PR-001', passYn: 'Y' } as any, 'C1', 'P1');

      expect(mockProdResultRepo.findOne).toHaveBeenCalledWith({
        where: { resultNo: 'PR-001', company: 'C1', plant: 'P1' },
      });
    });
    it('should throw when prodResult not found', async () => {
      mockProdResultRepo.findOne.mockResolvedValue(null);
      await expect(target.create({ prodResultNo: '999' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createByBarcode', () => {
    it('should resolve trace log and production result within tenant only', async () => {
      mockTraceLogRepo.findOne.mockResolvedValue({
        serialNo: 'BC-001',
        prdUid: 'PRD-001',
        eventData: JSON.stringify({ prodResultNo: 'PR-001' }),
        company: 'C1',
        plant: 'P1',
      } as any);
      mockProdResultRepo.findOne.mockResolvedValue({
        resultNo: 'PR-001',
        jobOrder: { part: { itemCode: 'ITEM-001', itemName: 'Part A' }, orderNo: 'JO-001' },
      } as any);
      mockSeqGen.getNo.mockResolvedValue('IR-001');
      mockInspectRepo.create.mockReturnValue({ resultNo: 'IR-001', passYn: 'Y', inspectAt: new Date() } as any);
      mockInspectRepo.save.mockResolvedValue({ resultNo: 'IR-001', passYn: 'Y', inspectAt: new Date() } as any);

      await target.createByBarcode({ barcode: 'BC-001', passYn: 'Y' } as any, 'C1', 'P1');

      expect(mockTraceLogRepo.findOne).toHaveBeenCalledWith({
        where: { serialNo: 'BC-001', company: 'C1', plant: 'P1' },
        order: { traceTime: 'DESC' },
      });
      expect(mockProdResultRepo.findOne).toHaveBeenCalledWith({
        where: { resultNo: 'PR-001', company: 'C1', plant: 'P1' },
        relations: ['jobOrder', 'jobOrder.part'],
      });
    });
  });

  describe('delete', () => {
    it('should delete inspect result', async () => {
      mockInspectRepo.findOne.mockResolvedValue({
        resultNo: 'IR-001',
        prodResultNo: 'PR-001',
      } as any);
      mockProdResultRepo.findOne.mockResolvedValue({
        resultNo: 'PR-001',
        status: 'CANCELED',
      } as any);
      mockInspectRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const r = await target.delete('IR-001');
      expect(r.deleted).toBe(true);
    });

    it('should delete inspect result within tenant only', async () => {
      mockInspectRepo.findOne.mockResolvedValue({
        resultNo: 'IR-001',
        prodResultNo: 'PR-001',
        company: 'C1',
        plant: 'P1',
      } as any);
      mockProdResultRepo.findOne.mockResolvedValue({
        resultNo: 'PR-001',
        status: 'CANCELED',
        company: 'C1',
        plant: 'P1',
      } as any);
      mockInspectRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('IR-001', 'C1', 'P1');

      expect(mockProdResultRepo.findOne).toHaveBeenCalledWith({
        where: { resultNo: 'PR-001', company: 'C1', plant: 'P1' },
      });
      expect(mockInspectRepo.delete).toHaveBeenCalledWith({ resultNo: 'IR-001', company: 'C1', plant: 'P1' });
    });

    it('should reject delete when loaded inspect result tenant differs from request tenant', async () => {
      mockInspectRepo.findOne.mockResolvedValue({
        resultNo: 'IR-001',
        prodResultNo: 'PR-001',
        company: 'OTHER',
        plant: 'P1',
      } as any);

      await expect(target.delete('IR-001', 'C1', 'P1')).rejects.toThrow(BadRequestException);

      expect(mockProdResultRepo.findOne).not.toHaveBeenCalled();
      expect(mockInspectRepo.delete).not.toHaveBeenCalled();
    });

    it('should block delete while linked production result is still active', async () => {
      mockInspectRepo.findOne.mockResolvedValue({
        resultNo: 'IR-002',
        prodResultNo: 'PR-002',
      } as any);
      mockProdResultRepo.findOne.mockResolvedValue({
        resultNo: 'PR-002',
        status: 'DONE',
      } as any);

      await expect(target.delete('IR-002')).rejects.toThrow(BadRequestException);
      expect(mockInspectRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('getPassRate', () => {
    // getPassRate는 buildBase()로 매 호출 새 QueryBuilder를 만들어
    // total/pass 각각 getCount()를 수행한다.
    const mockCountQb = () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };
      return qb;
    };

    it('should return pass rate', async () => {
      const totalQb = mockCountQb();
      totalQb.getCount.mockResolvedValue(100);
      const passQb = mockCountQb();
      passQb.getCount.mockResolvedValue(90);
      mockInspectRepo.createQueryBuilder
        .mockReturnValueOnce(totalQb as any)
        .mockReturnValueOnce(passQb as any);

      const r = await target.getPassRate();
      expect(r.totalCount).toBe(100);
      expect(r.passCount).toBe(90);
      expect(r.passRate).toBe(90);
    });
    it('should return 0 passRate when no data', async () => {
      mockInspectRepo.createQueryBuilder
        .mockReturnValueOnce(mockCountQb() as any)
        .mockReturnValueOnce(mockCountQb() as any);

      const r = await target.getPassRate();
      expect(r.passRate).toBe(0);
    });

    it('should scope pass rate by tenant', async () => {
      const totalQb = mockCountQb();
      totalQb.getCount.mockResolvedValue(100);
      const passQb = mockCountQb();
      passQb.getCount.mockResolvedValue(90);
      mockInspectRepo.createQueryBuilder
        .mockReturnValueOnce(totalQb as any)
        .mockReturnValueOnce(passQb as any);

      await target.getPassRate(undefined, undefined, undefined, 'C1', 'P1');

      // 두 QueryBuilder 모두 테넌트 스코프를 andWhere로 적용한다.
      expect(totalQb.andWhere).toHaveBeenCalledWith('inspect.company = :company', { company: 'C1' });
      expect(totalQb.andWhere).toHaveBeenCalledWith('inspect.plant = :plant', { plant: 'P1' });
      expect(passQb.andWhere).toHaveBeenCalledWith('inspect.company = :company', { company: 'C1' });
      expect(passQb.andWhere).toHaveBeenCalledWith('inspect.plant = :plant', { plant: 'P1' });
      // pass QueryBuilder는 추가로 passYn 필터를 적용한다.
      expect(passQb.andWhere).toHaveBeenCalledWith("inspect.passYn = 'Y'");
    });
  });

  describe('stats', () => {
    const mockStatsQb = (rows: any[]) => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };
      return qb;
    };

    it('should scope inspection type stats by tenant', async () => {
      const totalQb = mockStatsQb([{ inspectType: 'OQC', totalCount: '1' }]);
      const passQb = mockStatsQb([{ inspectType: 'OQC', passCount: '1' }]);
      mockInspectRepo.createQueryBuilder
        .mockReturnValueOnce(totalQb as any)
        .mockReturnValueOnce(passQb as any);

      await target.getStatsByType(undefined, undefined, 'C1', 'P1');

      // 테넌트 스코프는 andWhere로 적용된다.
      expect(totalQb.andWhere).toHaveBeenCalledWith('inspect.company = :company', { company: 'C1' });
      expect(totalQb.andWhere).toHaveBeenCalledWith('inspect.plant = :plant', { plant: 'P1' });
    });

    it('should scope daily pass rate trend by tenant', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockInspectRepo.createQueryBuilder.mockReturnValue(qb as any);

      await target.getDailyPassRateTrend(7, 'C1', 'P1');

      expect(qb.select).toHaveBeenCalledWith(['inspect.inspectAt', 'inspect.passYn']);
      expect(qb.orderBy).toHaveBeenCalledWith('inspect.inspectAt', 'ASC');
      expect(qb.andWhere).toHaveBeenCalledWith('inspect.company = :company', { company: 'C1' });
      expect(qb.andWhere).toHaveBeenCalledWith('inspect.plant = :plant', { plant: 'P1' });
    });
  });
});
