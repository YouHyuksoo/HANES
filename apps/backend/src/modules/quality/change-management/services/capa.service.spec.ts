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
import { MockLoggerService } from '@test/mock-logger.service';

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
      const r = await target.findById('CA-001');
      expect(r.capaNo).toBe('CA-001');
      expect(r.actions).toEqual([]);
    });
    it('should throw NotFoundException', async () => {
      mockCapaRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('999')).rejects.toThrow(NotFoundException);
    });

    it('scopes CAPA lookup and actions by tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', company: 'CO', plant: 'P01' } as any);
      mockActionRepo.find.mockResolvedValue([]);

      await target.findById('CA-001', 'CO', 'P01');

      expect(mockCapaRepo.findOne).toHaveBeenCalledWith({
        where: { capaNo: 'CA-001', company: 'CO', plant: 'P01' },
      });
      expect(mockActionRepo.find).toHaveBeenCalledWith({
        where: { capaId: 'CA-001' },
        order: { seq: 'ASC' },
      });
    });
  });

  describe('analyze', () => {
    it('should analyze from OPEN', async () => {
      const item = { id: 1, status: 'OPEN' } as any;
      mockCapaRepo.findOne.mockResolvedValue(item);
      mockCapaRepo.save.mockResolvedValue({ ...item, status: 'ANALYZING' });
      const r = await target.analyze('CA-001', { rootCause: 'test' } as any, 'user');
      expect(r.status).toBe('ANALYZING');
    });
    it('should throw when not OPEN', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ id: 1, status: 'CLOSED' } as any);
      await expect(target.analyze('CA-001', {} as any, 'user')).rejects.toThrow(BadRequestException);
    });

    it('rejects analyze when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'OPEN', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.analyze('CA-001', { rootCause: 'x' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('plan and start and verify', () => {
    it('rejects plan when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'ANALYZING', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.plan('CA-001', { actionPlan: 'x' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });

    it('rejects start when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'ACTION_PLANNED', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.start('CA-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });

    it('rejects verify when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'IN_PROGRESS', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.verify('CA-001', { verificationResult: 'ok' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close from VERIFYING', async () => {
      const item = { id: 1, status: 'VERIFYING' } as any;
      mockCapaRepo.findOne.mockResolvedValue(item);
      mockCapaRepo.save.mockResolvedValue({ ...item, status: 'CLOSED' });
      const r = await target.close('CA-001', 'user');
      expect(r.status).toBe('CLOSED');
    });

    it('rejects close when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'VERIFYING', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.close('CA-001', 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should throw when not OPEN', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ id: 1, status: 'ANALYZING' } as any);
      mockActionRepo.find.mockResolvedValue([]);
      await expect(target.delete('CA-001')).rejects.toThrow(BadRequestException);
    });

    it('rejects delete when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'OPEN', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.delete('CA-001', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockActionRepo.delete).not.toHaveBeenCalled();
      expect(mockCapaRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('update and actions', () => {
    it('rejects update when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', status: 'OPEN', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.update('CA-001', {} as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockCapaRepo.save).not.toHaveBeenCalled();
    });

    it('rejects addAction when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', company: 'OTHER', plant: 'P01' } as any);
      await expect(target.addAction('CA-001', { seq: 1, actionDesc: 'x' } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockActionRepo.save).not.toHaveBeenCalled();
    });

    it('rejects updateAction when CAPA belongs to a different tenant', async () => {
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', company: 'OTHER', plant: 'P01' } as any);

      await expect(
        target.updateAction('CA-001', 1, { actionDesc: 'x' } as any, 'user', 'CO', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(mockActionRepo.findOne).not.toHaveBeenCalled();
      expect(mockActionRepo.save).not.toHaveBeenCalled();
    });

    it('updates action only after CAPA tenant is validated', async () => {
      const action = { capaId: 'CA-001', seq: 1, actionDesc: 'old' } as CAPAAction;
      mockCapaRepo.findOne.mockResolvedValue({ capaNo: 'CA-001', company: 'CO', plant: 'P01' } as any);
      mockActionRepo.findOne.mockResolvedValue(action);
      mockActionRepo.save.mockImplementation(async (value) => value as CAPAAction);

      const result = await target.updateAction(
        'CA-001',
        1,
        { actionDesc: 'new' } as any,
        'user',
        'CO',
        'P01',
      );

      expect(mockCapaRepo.findOne).toHaveBeenCalledWith({
        where: { capaNo: 'CA-001', company: 'CO', plant: 'P01' },
      });
      expect(mockCapaRepo.update).toHaveBeenCalledWith(
        { capaNo: 'CA-001', company: 'CO', plant: 'P01' },
        { updatedBy: 'user' },
      );
      expect(result.actionDesc).toBe('new');
    });
  });
});
