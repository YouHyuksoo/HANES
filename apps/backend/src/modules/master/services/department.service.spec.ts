/**
 * @file src/modules/master/services/department.service.spec.ts
 * @description DepartmentService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "DepartmentService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DepartmentService } from './department.service';
import { DepartmentMaster } from '../../../entities/department-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('DepartmentService', () => {
  let target: DepartmentService;
  let mockRepo: DeepMocked<Repository<DepartmentMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<DepartmentMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: getRepositoryToken(DepartmentMaster), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<DepartmentService>(DepartmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return department when found', async () => {
      // Arrange
      const dept = { deptCode: 'D01', deptName: 'Engineering' } as DepartmentMaster;
      mockRepo.findOne.mockResolvedValue(dept);

      // Act
      const result = await target.findById('D01');

      // Assert
      expect(result).toEqual(dept);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('D99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new department', async () => {
      // Arrange
      const dto = { deptCode: 'D01', deptName: 'Engineering' } as any;
      const created = { ...dto, useYn: 'Y', sortOrder: 0 } as DepartmentMaster;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when dept code exists', async () => {
      // Arrange
      const dto = { deptCode: 'D01', deptName: 'Engineering' } as any;
      mockRepo.findOne.mockResolvedValue({ deptCode: 'D01' } as DepartmentMaster);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return department', async () => {
      // Arrange
      const existing = { deptCode: 'D01', deptName: 'Old' } as DepartmentMaster;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('D01', { deptName: 'New' } as any);

      // Assert
      expect(result).toEqual(existing);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return id', async () => {
      // Arrange
      const existing = { deptCode: 'D01' } as DepartmentMaster;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('D01');

      // Assert
      expect(result).toEqual({ id: 'D01' });
    });
  });
});
