/**
 * @file continuity-inspect.service.spec.ts
 * @description ContinuityInspectService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ContinuityInspectService } from './continuity-inspect.service';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { JobOrder } from '../../../../entities/job-order.entity';
import { EquipProtocol } from '../../../../entities/equip-protocol.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('ContinuityInspectService', () => {
  let target: ContinuityInspectService;
  let mockInspectRepo: DeepMocked<Repository<InspectResult>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockJobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let mockProtocolRepo: DeepMocked<Repository<EquipProtocol>>;
  let mockSeqGen: DeepMocked<SeqGeneratorService>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockInspectRepo = createMock<Repository<InspectResult>>();
    mockFgLabelRepo = createMock<Repository<FgLabel>>();
    mockJobOrderRepo = createMock<Repository<JobOrder>>();
    mockProtocolRepo = createMock<Repository<EquipProtocol>>();
    mockSeqGen = createMock<SeqGeneratorService>();
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
        ContinuityInspectService,
        { provide: getRepositoryToken(InspectResult), useValue: mockInspectRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgLabelRepo },
        { provide: getRepositoryToken(JobOrder), useValue: mockJobOrderRepo },
        { provide: getRepositoryToken(EquipProtocol), useValue: mockProtocolRepo },
        { provide: SeqGeneratorService, useValue: mockSeqGen },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ContinuityInspectService>(ContinuityInspectService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findFgLabel', () => {
    it('should return label', async () => {
      mockFgLabelRepo.findOne.mockResolvedValue({ fgBarcode: 'FG001' } as any);
      const r = await target.findFgLabel('FG001');
      expect(r.fgBarcode).toBe('FG001');
    });
    it('should throw NotFoundException', async () => {
      mockFgLabelRepo.findOne.mockResolvedValue(null);
      await expect(target.findFgLabel('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reprintLabel', () => {
    it('should increment reprintCount', async () => {
      const label = { fgBarcode: 'FG001', status: 'ISSUED', reprintCount: 0 } as any;
      mockFgLabelRepo.findOne.mockResolvedValue(label);
      mockFgLabelRepo.save.mockResolvedValue({ ...label, reprintCount: 1 });
      const r = await target.reprintLabel('FG001');
      expect(r.reprintCount).toBe(1);
    });
    it('should throw for VOIDED label', async () => {
      mockFgLabelRepo.findOne.mockResolvedValue({ fgBarcode: 'FG001', status: 'VOIDED' } as any);
      await expect(target.reprintLabel('FG001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('voidLabel', () => {
    it('should void label', async () => {
      const label = { fgBarcode: 'FG001', status: 'ISSUED' } as any;
      mockFgLabelRepo.findOne.mockResolvedValue(label);
      mockFgLabelRepo.save.mockResolvedValue({ ...label, status: 'VOIDED' });
      const r = await target.voidLabel('FG001', 'damaged');
      expect(r.status).toBe('VOIDED');
    });
    it('should throw for already VOIDED', async () => {
      mockFgLabelRepo.findOne.mockResolvedValue({ fgBarcode: 'FG001', status: 'VOIDED' } as any);
      await expect(target.voidLabel('FG001', 'reason')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should return inspection stats', async () => {
      mockFgLabelRepo.count.mockResolvedValue(10);
      mockJobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', planQty: 100, goodQty: 90, defectQty: 10 } as any);
      const r = await target.getStats('JO-001');
      expect(r.passed).toBe(90);
      expect(r.failed).toBe(10);
      expect(r.passRate).toBe(90);
    });
    it('should throw when job order not found', async () => {
      mockFgLabelRepo.count.mockResolvedValue(0);
      mockJobOrderRepo.findOne.mockResolvedValue(null);
      await expect(target.getStats('INVALID')).rejects.toThrow(NotFoundException);
    });
  });
});
