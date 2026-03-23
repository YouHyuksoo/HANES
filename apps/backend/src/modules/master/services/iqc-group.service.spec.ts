/**
 * @file src/modules/master/services/iqc-group.service.spec.ts
 * @description IqcGroupService 단위 테스트 - 그룹 CRUD + 항목 매핑 일괄처리 검증
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "IqcGroupService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IqcGroupService } from './iqc-group.service';
import { IqcGroup } from '../../../entities/iqc-group.entity';
import { IqcGroupItem } from '../../../entities/iqc-group-item.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('IqcGroupService', () => {
  let target: IqcGroupService;
  let mockGroupRepo: DeepMocked<Repository<IqcGroup>>;
  let mockGroupItemRepo: DeepMocked<Repository<IqcGroupItem>>;

  beforeEach(async () => {
    mockGroupRepo = createMock<Repository<IqcGroup>>();
    mockGroupItemRepo = createMock<Repository<IqcGroupItem>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IqcGroupService,
        { provide: getRepositoryToken(IqcGroup), useValue: mockGroupRepo },
        { provide: getRepositoryToken(IqcGroupItem), useValue: mockGroupItemRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<IqcGroupService>(IqcGroupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findByCode ───
  describe('findByCode', () => {
    it('should return group with items when found', async () => {
      // Arrange
      const group = { groupCode: 'IG01', groupName: 'Group1', items: [] } as any;
      mockGroupRepo.findOne.mockResolvedValue(group);

      // Act
      const result = await target.findByCode('IG01');

      // Assert
      expect(result).toEqual(group);
      expect(mockGroupRepo.findOne).toHaveBeenCalledWith({
        where: { groupCode: 'IG01' },
        relations: ['items', 'items.inspItem'],
      });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockGroupRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByCode('IG99')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create group and save items', async () => {
      // Arrange
      const dto = {
        groupCode: 'IG01',
        groupName: 'Group1',
        inspectMethod: 'FULL',
        items: [{ itemId: 1, seq: 1 }],
      } as any;
      const savedGroup = { groupCode: 'IG01', groupName: 'Group1' } as any;
      const fullGroup = { ...savedGroup, items: [] } as any;

      mockGroupRepo.findOne
        .mockResolvedValueOnce(null) // existence check
        .mockResolvedValueOnce(fullGroup); // findByCode after create
      mockGroupRepo.create.mockReturnValue(savedGroup);
      mockGroupRepo.save.mockResolvedValue(savedGroup);
      mockGroupItemRepo.create.mockReturnValue({} as any);
      mockGroupItemRepo.save.mockResolvedValue([] as any);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(mockGroupItemRepo.save).toHaveBeenCalled();
    });

    it('should create group without items when items array is empty', async () => {
      // Arrange
      const dto = { groupCode: 'IG01', groupName: 'Group1', inspectMethod: 'FULL' } as any;
      const savedGroup = { groupCode: 'IG01' } as any;

      mockGroupRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...savedGroup, items: [] });
      mockGroupRepo.create.mockReturnValue(savedGroup);
      mockGroupRepo.save.mockResolvedValue(savedGroup);

      // Act
      await target.create(dto);

      // Assert
      expect(mockGroupItemRepo.save).not.toHaveBeenCalled();
    });

    it('should set sampleQty to null when inspectMethod is not SAMPLE', async () => {
      // Arrange
      const dto = { groupCode: 'IG01', groupName: 'Group1', inspectMethod: 'FULL' } as any;
      const savedGroup = { groupCode: 'IG01' } as any;

      mockGroupRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...savedGroup, items: [] });
      mockGroupRepo.create.mockReturnValue(savedGroup);
      mockGroupRepo.save.mockResolvedValue(savedGroup);

      // Act
      await target.create(dto);

      // Assert
      expect(mockGroupRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sampleQty: null }),
      );
    });

    it('should throw ConflictException when group code exists', async () => {
      // Arrange
      const dto = { groupCode: 'IG01' } as any;
      mockGroupRepo.findOne.mockResolvedValue({ groupCode: 'IG01' } as IqcGroup);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update group and replace items', async () => {
      // Arrange
      const existing = { groupCode: 'IG01', groupName: 'Old', items: [] } as any;
      mockGroupRepo.findOne.mockResolvedValue(existing);
      mockGroupRepo.save.mockResolvedValue(existing);
      mockGroupItemRepo.delete.mockResolvedValue({ affected: 1 } as any);
      mockGroupItemRepo.create.mockReturnValue({} as any);
      mockGroupItemRepo.save.mockResolvedValue([] as any);

      // Act
      await target.update('IG01', {
        groupName: 'New',
        items: [{ itemId: 2, seq: 1 }],
      } as any);

      // Assert
      expect(mockGroupItemRepo.delete).toHaveBeenCalledWith({ groupCode: 'IG01' });
      expect(mockGroupItemRepo.save).toHaveBeenCalled();
    });

    it('should set sampleQty to null when switching from SAMPLE to other', async () => {
      // Arrange
      const existing = { groupCode: 'IG01', inspectMethod: 'SAMPLE', sampleQty: 5, items: [] } as any;
      mockGroupRepo.findOne.mockResolvedValue(existing);
      mockGroupRepo.save.mockResolvedValue(existing);

      // Act
      await target.update('IG01', { inspectMethod: 'FULL' } as any);

      // Assert
      expect(existing.sampleQty).toBeNull();
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should remove group and return confirmation', async () => {
      // Arrange
      const existing = { groupCode: 'IG01', items: [] } as any;
      mockGroupRepo.findOne.mockResolvedValue(existing);
      mockGroupRepo.remove.mockResolvedValue(existing);

      // Act
      const result = await target.delete('IG01');

      // Assert
      expect(result).toEqual({ groupCode: 'IG01', deleted: true });
    });
  });
});
