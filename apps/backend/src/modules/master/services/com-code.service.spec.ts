/**
 * @file src/modules/master/services/com-code.service.spec.ts
 * @description ComCodeService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "ComCodeService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ComCodeService } from './com-code.service';
import { ComCode } from '../../../entities/com-code.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('ComCodeService', () => {
  let target: ComCodeService;
  let mockRepo: DeepMocked<Repository<ComCode>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<ComCode>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComCodeService,
        { provide: getRepositoryToken(ComCode), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ComCodeService>(ComCodeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAllActive ───
  describe('findAllActive', () => {
    it('should return codes grouped by groupCode', async () => {
      // Arrange
      const codes = [
        { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Name1', codeDesc: null, sortOrder: 1, attr1: null, attr2: null, attr3: null },
        { groupCode: 'GRP1', detailCode: 'D2', codeName: 'Name2', codeDesc: null, sortOrder: 2, attr1: null, attr2: null, attr3: null },
        { groupCode: 'GRP2', detailCode: 'D1', codeName: 'Name3', codeDesc: null, sortOrder: 1, attr1: null, attr2: null, attr3: null },
      ] as ComCode[];
      mockRepo.find.mockResolvedValue(codes);

      // Act
      const result = await target.findAllActive();

      // Assert
      expect(result['GRP1']).toHaveLength(2);
      expect(result['GRP2']).toHaveLength(1);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { useYn: 'Y' },
        order: { groupCode: 'asc', sortOrder: 'asc' },
        select: expect.any(Object),
      });
    });

    it('should return active codes within tenant only', async () => {
      mockRepo.find.mockResolvedValue([]);

      await target.findAllActive('C1', 'P1');

      expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { useYn: 'Y', company: 'C1', plant: 'P1' },
      }));
    });

    it('should return empty object when no codes exist', async () => {
      // Arrange
      mockRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.findAllActive();

      // Assert
      expect(result).toEqual({});
    });
  });

  // ─── findById ───
  describe('findAllGroups', () => {
    it('should count groups within tenant only', async () => {
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ groupCode: 'GRP1', count: '2' }]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await target.findAllGroups('C1', 'P1');

      expect(result).toEqual([{
        groupCode: 'GRP1',
        count: 2,
        detailCodes: [],
        searchText: { ko: '', en: '', zh: '', vi: '' },
      }]);
      expect(qb.andWhere).toHaveBeenCalledWith('code.company = :company', { company: 'C1' });
      expect(qb.andWhere).toHaveBeenCalledWith('code.plant = :plant', { plant: 'P1' });
    });

    it('should return language-specific search text for each group', async () => {
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            groupCode: 'JOB_ORDER_STATUS',
            count: '2',
            detailCodes: 'WAIT COMPLETE',
            searchTextKo: '대기 완료',
            searchTextEn: 'Waiting Complete',
            searchTextZh: '等待 完成',
            searchTextVi: 'Cho Hoan thanh',
          },
        ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await target.findAllGroups();

      expect(result).toEqual([
        {
          groupCode: 'JOB_ORDER_STATUS',
          count: 2,
          detailCodes: ['WAIT', 'COMPLETE'],
          searchText: {
            ko: '대기 완료',
            en: 'Waiting Complete',
            zh: '等待 完成',
            vi: 'Cho Hoan thanh',
          },
        },
      ]);
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('code.detailCode'),
        'detailCodes',
      );
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('code.codeName'),
        'searchTextKo',
      );
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('code.attr1'),
        'searchTextEn',
      );
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('code.attr2'),
        'searchTextZh',
      );
      expect(qb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('code.attr3'),
        'searchTextVi',
      );
    });
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return code when found', async () => {
      // Arrange
      const code = { groupCode: 'GRP1', detailCode: 'D1' } as ComCode;
      mockRepo.findOne.mockResolvedValue(code);

      // Act
      const result = await target.findById('GRP1::D1', 'C1', 'P1');

      // Assert
      expect(result).toEqual(code);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { groupCode: 'GRP1', detailCode: 'D1', company: 'C1', plant: 'P1' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('GRP1::D1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByCode ───
  describe('findByCode', () => {
    it('should return code when found', async () => {
      // Arrange
      const code = { groupCode: 'GRP1', detailCode: 'D1' } as ComCode;
      mockRepo.findOne.mockResolvedValue(code);

      // Act
      const result = await target.findByCode('GRP1', 'D1', 'C1', 'P1');

      // Assert
      expect(result).toEqual(code);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { groupCode: 'GRP1', detailCode: 'D1', company: 'C1', plant: 'P1' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findByCode('GRP1', 'D1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new com code', async () => {
      // Arrange
      const dto = { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Test' } as any;
      const created = { ...dto, useYn: 'Y', sortOrder: 0 } as ComCode;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should check duplicate code within tenant when creating', async () => {
      const dto = { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Test' } as any;
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ ...dto, company: 'C1', plant: 'P1' } as ComCode);
      mockRepo.save.mockResolvedValue({ ...dto, company: 'C1', plant: 'P1' } as ComCode);

      await target.create(dto, 'C1', 'P1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { groupCode: 'GRP1', detailCode: 'D1', company: 'C1', plant: 'P1' },
      });
    });

    it('should throw ConflictException when code already exists', async () => {
      // Arrange
      const dto = { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Test' } as any;
      mockRepo.findOne.mockResolvedValue({ groupCode: 'GRP1' } as ComCode);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return the code', async () => {
      // Arrange
      const existing = { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Old' } as ComCode;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('GRP1::D1', { codeName: 'New' } as any);

      // Assert
      expect(result).toEqual(existing);
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('should update within tenant and strip key/tenant columns from payload', async () => {
      const existing = { groupCode: 'GRP1', detailCode: 'D1', codeName: 'Old', company: 'C1', plant: 'P1' } as ComCode;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.update('GRP1::D1', {
        groupCode: 'GRP2',
        detailCode: 'D2',
        codeName: 'New',
        company: 'C2',
        plant: 'P2',
      } as any, 'C1', 'P1');

      expect(mockRepo.update).toHaveBeenCalledWith(
        { groupCode: 'GRP1', detailCode: 'D1', company: 'C1', plant: 'P1' },
        expect.not.objectContaining({
          groupCode: expect.anything(),
          detailCode: expect.anything(),
          company: expect.anything(),
          plant: expect.anything(),
        }),
      );
    });

    it('should throw NotFoundException when code not found', async () => {
      // Arrange
      mockRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.update('GRP1::D1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return result', async () => {
      // Arrange
      const existing = { groupCode: 'GRP1', detailCode: 'D1' } as ComCode;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('GRP1::D1');

      // Assert
      expect(result).toEqual({ id: 'GRP1::D1', deleted: true });
    });

    it('should delete within tenant only', async () => {
      const existing = { groupCode: 'GRP1', detailCode: 'D1', company: 'C1', plant: 'P1' } as ComCode;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('GRP1::D1', 'C1', 'P1');

      expect(mockRepo.delete).toHaveBeenCalledWith({
        groupCode: 'GRP1',
        detailCode: 'D1',
        company: 'C1',
        plant: 'P1',
      });
    });
  });

  // ─── deleteByGroupCode ───
  describe('deleteByGroupCode', () => {
    it('should delete all codes in group and return count', async () => {
      // Arrange
      mockRepo.delete.mockResolvedValue({ affected: 5 } as any);

      // Act
      const result = await target.deleteByGroupCode('GRP1', 'C1', 'P1');

      // Assert
      expect(result).toEqual({ count: 5 });
      expect(mockRepo.delete).toHaveBeenCalledWith({ groupCode: 'GRP1', company: 'C1', plant: 'P1' });
    });
  });

  // ─── findByGroupCode ───
  describe('findByGroupCode', () => {
    it('should return active codes for group', async () => {
      // Arrange
      const codes = [{ groupCode: 'GRP1', detailCode: 'D1' }] as ComCode[];
      mockRepo.find.mockResolvedValue(codes);

      // Act
      const result = await target.findByGroupCode('GRP1', 'C1', 'P1');

      // Assert
      expect(result).toEqual(codes);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { groupCode: 'GRP1', useYn: 'Y', company: 'C1', plant: 'P1' },
        order: { sortOrder: 'asc' },
      });
    });
  });
});
