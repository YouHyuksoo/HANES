/**
 * @file inspect-result.service.spec.ts
 * @description InspectResultService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InspectResultService } from './inspect-result.service';
import { InspectResult } from '../../../../entities/inspect-result.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { TraceLog } from '../../../../entities/trace-log.entity';
import { SeqGeneratorService } from '../../../../shared/seq-generator.service';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

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
    it('should throw when prodResult not found', async () => {
      mockProdResultRepo.findOne.mockResolvedValue(null);
      await expect(target.create({ prodResultNo: '999' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete inspect result', async () => {
      mockInspectRepo.findOne.mockResolvedValue({ resultNo: 'IR-001' } as any);
      mockInspectRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const r = await target.delete('IR-001');
      expect(r.deleted).toBe(true);
    });
  });

  describe('getPassRate', () => {
    it('should return pass rate', async () => {
      mockInspectRepo.count.mockResolvedValueOnce(100).mockResolvedValueOnce(90);
      const r = await target.getPassRate();
      expect(r.totalCount).toBe(100);
      expect(r.passCount).toBe(90);
      expect(r.passRate).toBe(90);
    });
    it('should return 0 passRate when no data', async () => {
      mockInspectRepo.count.mockResolvedValue(0);
      const r = await target.getPassRate();
      expect(r.passRate).toBe(0);
    });
  });
});
