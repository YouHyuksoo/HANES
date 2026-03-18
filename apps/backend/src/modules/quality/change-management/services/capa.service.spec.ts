/**
 * @file capa.service.spec.ts
 * @description CapaService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CapaService } from './capa.service';
import { CAPARequest } from '../../../../entities/capa-request.entity';
import { CAPAAction } from '../../../../entities/capa-action.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('CapaService', () => {
  let target: CapaService;
  let mockCapaRepo: DeepMocked<Repository<CAPARequest>>;
  let mockActionRepo: DeepMocked<Repository<CAPAAction>>;

  beforeEach(async () => {
    mockCapaRepo = createMock<Repository<CAPARequest>>();
    mockActionRepo = createMock<Repository<CAPAAction>>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapaService,
        { provide: getRepositoryToken(CAPARequest), useValue: mockCapaRepo },
        { provide: getRepositoryToken(CAPAAction), useValue: mockActionRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<CapaService>(CapaService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return capa with actions', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ id: 1, capaNo: 'CA-001' } as any);
      mockActionRepo.find.mockResolvedValue([]);
      const r = await target.findById(1);
      expect(r.capaNo).toBe('CA-001');
      expect(r.actions).toEqual([]);
    });
    it('should throw NotFoundException', async () => {
      mockCapaRepo.findOne.mockResolvedValue(null);
      await expect(target.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('analyze', () => {
    it('should analyze from OPEN', async () => {
      const item = { id: 1, status: 'OPEN' } as any;
      mockCapaRepo.findOne.mockResolvedValue(item);
      mockCapaRepo.save.mockResolvedValue({ ...item, status: 'ANALYZING' });
      const r = await target.analyze(1, { rootCause: 'test' } as any, 'user');
      expect(r.status).toBe('ANALYZING');
    });
    it('should throw when not OPEN', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ id: 1, status: 'CLOSED' } as any);
      await expect(target.analyze(1, {} as any, 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('close', () => {
    it('should close from VERIFYING', async () => {
      const item = { id: 1, status: 'VERIFYING' } as any;
      mockCapaRepo.findOne.mockResolvedValue(item);
      mockCapaRepo.save.mockResolvedValue({ ...item, status: 'CLOSED' });
      const r = await target.close(1, 'user');
      expect(r.status).toBe('CLOSED');
    });
  });

  describe('delete', () => {
    it('should throw when not OPEN', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ id: 1, status: 'ANALYZING' } as any);
      mockActionRepo.find.mockResolvedValue([]);
      await expect(target.delete(1)).rejects.toThrow(BadRequestException);
    });
  });
});
