/**
 * @file rework-process.service.spec.ts
 * @description ReworkProcessService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReworkProcessService } from './rework-process.service';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { ReworkProcess } from '../../../../entities/rework-process.entity';
import { ReworkResult } from '../../../../entities/rework-result.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('ReworkProcessService', () => {
  let target: ReworkProcessService;
  let mockReworkRepo: DeepMocked<Repository<ReworkOrder>>;
  let mockProcessRepo: DeepMocked<Repository<ReworkProcess>>;
  let mockResultRepo: DeepMocked<Repository<ReworkResult>>;

  beforeEach(async () => {
    mockReworkRepo = createMock<Repository<ReworkOrder>>();
    mockProcessRepo = createMock<Repository<ReworkProcess>>();
    mockResultRepo = createMock<Repository<ReworkResult>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReworkProcessService,
        { provide: getRepositoryToken(ReworkOrder), useValue: mockReworkRepo },
        { provide: getRepositoryToken(ReworkProcess), useValue: mockProcessRepo },
        { provide: getRepositoryToken(ReworkResult), useValue: mockResultRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ReworkProcessService>(ReworkProcessService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findProcesses', () => {
    it('should find processes within tenant', async () => {
      mockProcessRepo.find.mockResolvedValue([]);

      await target.findProcesses('RW-001', 'CO', 'P01');

      expect(mockProcessRepo.find).toHaveBeenCalledWith({
        where: { reworkOrderId: 'RW-001', company: 'CO', plant: 'P01' },
        order: { seq: 'ASC' },
      });
    });
  });

  describe('startProcess', () => {
    it('should start WAITING process', async () => {
      const proc = { reworkOrderId: 1, processCode: 'P01', status: 'WAITING' } as any;
      mockProcessRepo.findOne.mockResolvedValue(proc);
      mockProcessRepo.save.mockResolvedValue({ ...proc, status: 'IN_PROGRESS' });
      mockReworkRepo.findOne.mockResolvedValue({ id: 1, status: 'APPROVED' } as any);
      mockReworkRepo.save.mockResolvedValue({} as any);
      const r = await target.startProcess('1', 'P01', 'user');
      expect(r.status).toBe('IN_PROGRESS');
    });
    it('should throw when not WAITING', async () => {
      mockProcessRepo.findOne.mockResolvedValue({ status: 'COMPLETED' } as any);
      await expect(target.startProcess('1', 'P01', 'user')).rejects.toThrow(BadRequestException);
    });
    it('should start process within tenant', async () => {
      const proc = { reworkOrderId: 'RW-001', processCode: 'P01', status: 'WAITING', company: 'CO', plant: 'P01' } as any;
      mockProcessRepo.findOne.mockResolvedValue(proc);
      mockProcessRepo.save.mockResolvedValue({ ...proc, status: 'IN_PROGRESS' });
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'APPROVED', company: 'CO', plant: 'P01' } as any);
      mockReworkRepo.save.mockResolvedValue({} as any);

      await target.startProcess('RW-001', 'P01', 'user', 'CO', 'P01');

      expect(mockProcessRepo.findOne).toHaveBeenCalledWith({
        where: { reworkOrderId: 'RW-001', processCode: 'P01', company: 'CO', plant: 'P01' },
      });
      expect(mockReworkRepo.findOne).toHaveBeenCalledWith({
        where: { reworkNo: 'RW-001', company: 'CO', plant: 'P01' },
      });
    });
  });

  describe('completeProcess', () => {
    it('should complete IN_PROGRESS process', async () => {
      const proc = { reworkOrderId: 1, processCode: 'P01', status: 'IN_PROGRESS' } as any;
      mockProcessRepo.findOne.mockResolvedValueOnce(proc).mockResolvedValue(null);
      mockProcessRepo.save.mockResolvedValue({ ...proc, status: 'COMPLETED' });
      mockProcessRepo.find.mockResolvedValue([{ status: 'COMPLETED', resultQty: 10 } as any]);
      mockReworkRepo.findOne.mockResolvedValue({ id: 1, status: 'IN_PROGRESS' } as any);
      mockReworkRepo.save.mockResolvedValue({} as any);
      const r = await target.completeProcess('1', 'P01', 10, 'user');
      expect(r.status).toBe('COMPLETED');
    });
  });

  describe('skipProcess', () => {
    it('should skip WAITING process', async () => {
      const proc = { reworkOrderId: 1, processCode: 'P01', status: 'WAITING' } as any;
      mockProcessRepo.findOne.mockResolvedValueOnce(proc).mockResolvedValue(null);
      mockProcessRepo.save.mockResolvedValue({ ...proc, status: 'SKIPPED' });
      mockProcessRepo.find.mockResolvedValue([{ status: 'SKIPPED', resultQty: 0 } as any]);
      mockReworkRepo.findOne.mockResolvedValue({ id: 1, status: 'IN_PROGRESS' } as any);
      mockReworkRepo.save.mockResolvedValue({} as any);
      const r = await target.skipProcess('1', 'P01', 'user');
      expect(r.status).toBe('SKIPPED');
    });
  });

  describe('createResult', () => {
    it('should count and aggregate results within tenant', async () => {
      const proc = { reworkOrderId: 'RW-001', processCode: 'P01', status: 'IN_PROGRESS', company: 'CO', plant: 'P01' } as any;
      mockProcessRepo.findOne.mockResolvedValue(proc);
      mockResultRepo.count.mockResolvedValue(0);
      mockResultRepo.create.mockReturnValue({ reworkOrderId: 'RW-001', processCode: 'P01', seq: 1, resultQty: 5 } as any);
      mockResultRepo.save.mockResolvedValue({ reworkOrderId: 'RW-001', processCode: 'P01', seq: 1, resultQty: 5 } as any);
      mockResultRepo.find.mockResolvedValue([{ resultQty: 5 } as any]);

      await target.createResult(
        { reworkOrderId: 'RW-001', processCode: 'P01', resultQty: 5 } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockProcessRepo.findOne).toHaveBeenCalledWith({
        where: { reworkOrderId: 'RW-001', processCode: 'P01', company: 'CO', plant: 'P01' },
      });
      expect(mockResultRepo.count).toHaveBeenCalledWith({
        where: { reworkOrderId: 'RW-001', processCode: 'P01', company: 'CO', plant: 'P01' },
      });
      expect(mockResultRepo.find).toHaveBeenCalledWith({
        where: { reworkOrderId: 'RW-001', processCode: 'P01', company: 'CO', plant: 'P01' },
      });
    });
  });
});
