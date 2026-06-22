/**
 * @file src/modules/master/services/bom.service.spec.ts
 * @description BomService 단위 테스트 - BOM CRUD, 계층 조회, 자기참조 방지 검증
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "BomService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BomService } from './bom.service';
import { BomMaster } from '../../../entities/bom-master.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('BomService', () => {
  let target: BomService;
  let mockBomRepo: DeepMocked<Repository<BomMaster>>;
  let mockPartRepo: DeepMocked<Repository<PartMaster>>;

  beforeEach(async () => {
    mockBomRepo = createMock<Repository<BomMaster>>();
    mockPartRepo = createMock<Repository<PartMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomService,
        { provide: getRepositoryToken(BomMaster), useValue: mockBomRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<BomService>(BomService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ───
  describe('findById', () => {
    it('should return bom with part info when found', async () => {
      // Arrange
      const bom = { parentItemCode: 'P01', childItemCode: 'C01', revision: 'A' } as BomMaster;
      mockBomRepo.findOne.mockResolvedValue(bom);
      mockPartRepo.find.mockResolvedValue([
        { itemCode: 'P01', itemName: 'Parent' } as PartMaster,
        { itemCode: 'C01', itemName: 'Child' } as PartMaster,
      ]);

      // Act
      const result = await target.findById('P01::C01::A');

      // Assert
      expect(result.parentItemCode).toBe('P01');
      expect(result.parentPart).toEqual({ itemCode: 'P01', itemName: 'Parent' });
      expect(result.childPart).toEqual({ itemCode: 'C01', itemName: 'Child' });
    });

    it('should throw NotFoundException when bom not found', async () => {
      // Arrange
      mockBomRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('P01::C01::A')).rejects.toThrow(NotFoundException);
    });

    it('should default revision to A when not provided', async () => {
      // Arrange
      mockBomRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('P01::C01')).rejects.toThrow(NotFoundException);
      expect(mockBomRepo.findOne).toHaveBeenCalledWith({
        where: { parentItemCode: 'P01', childItemCode: 'C01', revision: 'A' },
      });
    });
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return empty data when no boms found', async () => {
      // Arrange
      mockBomRepo.findAndCount.mockResolvedValue([[], 0]);

      // Act
      const result = await target.findAll({ page: 1, limit: 10 } as any);

      // Assert
      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10 });
    });

    it('should enrich bom items with part info', async () => {
      // Arrange
      const boms = [{ parentItemCode: 'P01', childItemCode: 'C01' }] as BomMaster[];
      mockBomRepo.findAndCount.mockResolvedValue([boms, 1]);
      mockPartRepo.find.mockResolvedValue([
        { itemCode: 'P01', itemName: 'Parent' } as PartMaster,
        { itemCode: 'C01', itemName: 'Child' } as PartMaster,
      ]);

      // Act
      const result = await target.findAll({ page: 1, limit: 10 } as any);

      // Assert
      expect(result.data[0].parentPart).toEqual({ itemCode: 'P01', itemName: 'Parent' });
      expect(result.data[0].childPart).toEqual({ itemCode: 'C01', itemName: 'Child' });
    });

    it('should enrich bom items using part info within tenant only', async () => {
      const boms = [{ parentItemCode: 'P01', childItemCode: 'C01' }] as BomMaster[];
      mockBomRepo.findAndCount.mockResolvedValue([boms, 1]);
      mockPartRepo.find.mockResolvedValue([]);

      await target.findAll({ page: 1, limit: 10 } as any, 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'productType', 'spec', 'unit'],
      });
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should throw ConflictException when parent equals child', async () => {
      // Arrange
      const dto = { parentItemCode: 'P01', childItemCode: 'P01' } as any;

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when bom already exists', async () => {
      // Arrange
      const dto = { parentItemCode: 'P01', childItemCode: 'C01' } as any;
      mockBomRepo.findOne.mockResolvedValue({ parentItemCode: 'P01' } as BomMaster);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should create bom successfully', async () => {
      // Arrange
      const dto = { parentItemCode: 'P01', childItemCode: 'C01', qtyPer: 2 } as any;
      const created = { ...dto, revision: 'A', useYn: 'Y' } as BomMaster;
      mockBomRepo.findOne.mockResolvedValue(null);
      mockBomRepo.create.mockReturnValue(created);
      mockBomRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(created);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update and return bom', async () => {
      // Arrange
      const bom = { parentItemCode: 'P01', childItemCode: 'C01', revision: 'A' } as BomMaster;
      mockBomRepo.findOne.mockResolvedValue(bom);
      mockPartRepo.find.mockResolvedValue([]);
      mockBomRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('P01::C01::A', { qtyPer: 5 } as any);

      // Assert
      expect(mockBomRepo.update).toHaveBeenCalled();
    });
  });

  // ─── delete ───
  describe('delete', () => {
    it('should delete and return id', async () => {
      // Arrange
      const bom = { parentItemCode: 'P01', childItemCode: 'C01', revision: 'A' } as BomMaster;
      mockBomRepo.findOne.mockResolvedValue(bom);
      mockPartRepo.find.mockResolvedValue([]);
      mockBomRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('P01::C01::A');

      // Assert
      expect(result).toEqual({ id: 'P01::C01::A' });
    });
  });

  // ─── findParents ───
  describe('findParents', () => {
    it('should return parent items with bomCount parsed to int', async () => {
      // Arrange
      const rawRows = [
        { itemCode: 'P01', itemName: 'Parent', bomCount: '3', revisions: 'A,B' },
      ];
      mockBomRepo.query.mockResolvedValue(rawRows);

      // Act
      const result = await target.findParents();

      // Assert
      expect(result[0].bomCount).toBe(3);
      expect(result[0].revisions).toEqual(['A', 'B']);
    });

    it('should handle empty revisions', async () => {
      // Arrange
      mockBomRepo.query.mockResolvedValue([
        { itemCode: 'P01', bomCount: '1', revisions: null },
      ]);

      // Act
      const result = await target.findParents();

      // Assert
      expect(result[0].revisions).toEqual([]);
    });
  });

  // ─── findByParentId ───
  describe('findByParentId', () => {
    it('should return empty array when no children', async () => {
      // Arrange
      mockBomRepo.query.mockResolvedValue([]);

      // Act
      const result = await target.findByParentId('P01');

      // Assert
      expect(result).toEqual([]);
    });

    it('should enrich children with part info', async () => {
      // Arrange
      mockBomRepo.query.mockResolvedValue([
        { childItemCode: 'C01', parentItemCode: 'P01' },
      ]);
      mockPartRepo.find.mockResolvedValue([
        { itemCode: 'C01', itemName: 'Child1' } as PartMaster,
      ]);

      // Act
      const result = await target.findByParentId('P01');

      // Assert
      expect(result[0].childPart).toEqual({ itemCode: 'C01', itemName: 'Child1' });
    });

    it('should enrich child parts within tenant only', async () => {
      mockBomRepo.query.mockResolvedValue([
        { childItemCode: 'C01', parentItemCode: 'P01' },
      ]);
      mockPartRepo.find.mockResolvedValue([]);

      await target.findByParentId('P01', undefined, 'C1', 'P1');

      expect(mockPartRepo.find).toHaveBeenCalledWith({
        where: { itemCode: expect.anything(), company: 'C1', plant: 'P1' },
        select: ['itemCode', 'itemName', 'itemNo', 'itemType', 'productType', 'spec', 'unit'],
      });
    });
  });

  // ─── findHierarchy: bind helper 회귀 방지 ───
  describe('findHierarchy', () => {
    /**
     * findHierarchy의 bind() 헬퍼는 호출 순서대로 :N 위치 바인드를 채운다.
     * SQL의 절 추가/위치 변경 시 묵시적으로 깨질 수 있으므로 다음을 보장한다:
     *  - params 길이 = SQL에 나타난 unique :N 의 개수
     *  - 각 :N 의 값이 절의 의미와 일치 (예: START WITH 바인드 = parentItemCode)
     *  - PLANT_CD 컬럼명 (PLANT 아님) 사용
     */
    it('should bind parentItemCode to START WITH and use PLANT_CD column', async () => {
      mockBomRepo.query.mockResolvedValue([]);

      await target.findHierarchy('P01', 3, undefined, 'C1', 'PL1');

      const [sql, params] = mockBomRepo.query.mock.calls[0] as [string, string[]];

      // PLANT_CD가 정확히 사용되어야 한다 (예전 b.PLANT 로 오타냈던 회귀 방지)
      expect(sql).toContain('b.PLANT_CD');
      expect(sql).not.toMatch(/b\.PLANT(?!\s*_)/);

      // SQL에 등장한 모든 :N 의 N이 1..params.length 범위 안이고 빠짐 없어야 한다
      const bindNumbers = new Set<number>();
      for (const m of sql.matchAll(/:(\d+)/g)) {
        bindNumbers.add(Number(m[1]));
      }
      const sortedBinds = [...bindNumbers].sort((a, b) => a - b);
      for (let i = 0; i < sortedBinds.length; i++) {
        expect(sortedBinds[i]).toBe(i + 1);
      }
      expect(sortedBinds.length).toBe(params.length);

      // START WITH :N 자리에 들어간 바인드 N이 parentItemCode 값과 매칭되는지
      const startWithMatch = sql.match(/START\s+WITH\s+b\.PARENT_ITEM_CODE\s*=\s*:(\d+)/i);
      expect(startWithMatch).not.toBeNull();
      const startWithIdx = Number(startWithMatch![1]);
      expect(params[startWithIdx - 1]).toBe('P01');

      // company / plant 값이 params에 포함되어야 한다
      expect(params).toContain('C1');
      expect(params).toContain('PL1');
    });

    it('should bind effectiveDate twice in WHERE and twice in CONNECT BY', async () => {
      mockBomRepo.query.mockResolvedValue([]);

      await target.findHierarchy('P01', 3, '2026-05-26');

      const [, params] = mockBomRepo.query.mock.calls[0] as [string, string[]];

      // WHERE 2개 + CONNECT BY 2개 = effectiveDate 4번, parentItemCode 1번
      const dateCount = params.filter((p) => p === '2026-05-26').length;
      expect(dateCount).toBe(4);
      expect(params).toContain('P01');
      expect(params.length).toBe(5);
    });

    it('should keep bind positions stable when only plant is provided (no company, no date)', async () => {
      // 조건부 절이 모두 빠졌을 때도 :N 번호가 1부터 순차여야 한다 (헬퍼 회귀 방지)
      mockBomRepo.query.mockResolvedValue([]);

      await target.findHierarchy('P01', 3, undefined, undefined, 'PL1');

      const [sql, params] = mockBomRepo.query.mock.calls[0] as [string, string[]];

      const bindNumbers = [...new Set(
        [...sql.matchAll(/:(\d+)/g)].map((m) => Number(m[1])),
      )].sort((a, b) => a - b);
      for (let i = 0; i < bindNumbers.length; i++) {
        expect(bindNumbers[i]).toBe(i + 1);
      }
      expect(bindNumbers.length).toBe(params.length);

      // WHERE + CONNECT BY 각각의 PLANT_CD 바인드 + parentItemCode = 3
      expect(params).toEqual(expect.arrayContaining(['PL1', 'P01']));
      expect(params.length).toBe(3);
    });
  });
});
