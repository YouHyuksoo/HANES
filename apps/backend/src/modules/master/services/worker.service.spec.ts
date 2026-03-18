/**
 * @file src/modules/master/services/worker.service.spec.ts
 * @description WorkerService 단위 테스트 - processIds JSON 파싱, QR 코드 조회 로직 검증
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "WorkerService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WorkerService } from './worker.service';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('WorkerService', () => {
  let target: WorkerService;
  let mockRepo: DeepMocked<Repository<WorkerMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<WorkerMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        { provide: getRepositoryToken(WorkerMaster), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<WorkerService>(WorkerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return worker with parsed processIds', async () => {
      // Arrange
      const worker = {
        workerCode: 'W01',
        workerName: 'Kim',
        processIds: '["P1","P2"]',
      } as WorkerMaster;
      mockRepo.findOne.mockResolvedValue(worker);

      // Act
      const result = await target.findById('W01');

      // Assert
      expect(result.processIds).toEqual(['P1', 'P2']);
    });

    it('should return empty array when processIds is null', async () => {
      // Arrange
      const worker = { workerCode: 'W01', processIds: null } as WorkerMaster;
      mockRepo.findOne.mockResolvedValue(worker);

      // Act
      const result = await target.findById('W01');

      // Assert
      expect(result.processIds).toEqual([]);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('W99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByQrCode ───
  describe('findByQrCode', () => {
    it('should find by qrCode field first', async () => {
      // Arrange
      const worker = { workerCode: 'W01', workerName: 'Kim', dept: 'ENG' } as WorkerMaster;
      mockRepo.findOne.mockResolvedValue(worker);

      // Act
      const result = await target.findByQrCode('QR123');

      // Assert
      expect(result).toEqual({ workerCode: 'W01', workerName: 'Kim', dept: 'ENG' });
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { qrCode: 'QR123' } });
    });

    it('should fallback to workerCode when qrCode not found', async () => {
      // Arrange
      const worker = { workerCode: 'W01', workerName: 'Kim', dept: 'ENG' } as WorkerMaster;
      mockRepo.findOne
        .mockResolvedValueOnce(null) // qrCode not found
        .mockResolvedValueOnce(worker); // workerCode found

      // Act
      const result = await target.findByQrCode('W01');

      // Assert
      expect(result).toEqual({ workerCode: 'W01', workerName: 'Kim', dept: 'ENG' });
    });

    it('should throw NotFoundException when both lookups fail', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByQrCode('UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create worker and stringify processIds', async () => {
      // Arrange
      const dto = {
        workerCode: 'W01',
        workerName: 'Kim',
        processIds: ['P1', 'P2'],
      } as any;
      const created = { ...dto, processIds: '["P1","P2"]' } as WorkerMaster;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result.processIds).toEqual(['P1', 'P2']);
    });

    it('should throw ConflictException when worker code exists', async () => {
      // Arrange
      const dto = { workerCode: 'W01', workerName: 'Kim' } as any;
      mockRepo.findOne.mockResolvedValue({ workerCode: 'W01' } as WorkerMaster);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should stringify processIds when updating', async () => {
      // Arrange
      const existing = { workerCode: 'W01', processIds: '["P1"]' } as WorkerMaster;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('W01', { processIds: ['P1', 'P2'] } as any);

      // Assert
      expect(mockRepo.update).toHaveBeenCalledWith(
        { workerCode: 'W01' },
        expect.objectContaining({ processIds: '["P1","P2"]' }),
      );
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return workerCode', async () => {
      // Arrange
      const existing = { workerCode: 'W01', processIds: null } as WorkerMaster;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('W01');

      // Assert
      expect(result).toEqual({ workerCode: 'W01' });
    });
  });
});
