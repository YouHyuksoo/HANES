/**
 * @file src/modules/master/services/equip-bom.service.spec.ts
 * @description EquipBomService 단위 테스트 - BOM 품목 + 설비-BOM 연결 CRUD 검증
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "EquipBomService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EquipBomService } from './equip-bom.service';
import { EquipBomItem } from '../../../entities/equip-bom-item.entity';
import { EquipBomRel } from '../../../entities/equip-bom-rel.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('EquipBomService', () => {
  let target: EquipBomService;
  let mockBomItemRepo: DeepMocked<Repository<EquipBomItem>>;
  let mockBomRelRepo: DeepMocked<Repository<EquipBomRel>>;

  beforeEach(async () => {
    mockBomItemRepo = createMock<Repository<EquipBomItem>>();
    mockBomRelRepo = createMock<Repository<EquipBomRel>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipBomService,
        { provide: getRepositoryToken(EquipBomItem), useValue: mockBomItemRepo },
        { provide: getRepositoryToken(EquipBomRel), useValue: mockBomRelRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<EquipBomService>(EquipBomService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── BOM Item CRUD ───

  describe('findItem', () => {
    it('should return item when found', async () => {
      // Arrange
      const item = { equipCode: 'EQ01', bomItemCode: 'BI01', bomItemName: 'Bolt' } as EquipBomItem;
      mockBomItemRepo.findOne.mockResolvedValue(item);

      // Act
      const result = await target.findItem('EQ01', 'BI01');

      // Assert
      expect(result).toEqual(item);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockBomItemRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findItem('EQ01', 'BI99')).rejects.toThrow(NotFoundException);
    });

    it('should find item within tenant only', async () => {
      mockBomItemRepo.findOne.mockResolvedValue({ equipCode: 'EQ01', bomItemCode: 'BI01', company: 'C1', plant: 'P1' } as EquipBomItem);

      await target.findItem('EQ01', 'BI01', 'C1', 'P1');

      expect(mockBomItemRepo.findOne).toHaveBeenCalledWith({
        where: { equipCode: 'EQ01', bomItemCode: 'BI01', company: 'C1', plant: 'P1' },
      });
    });
  });

  describe('createItem', () => {
    it('should create and return item with tenant and default columns', async () => {
      // Arrange
      const dto = { equipCode: 'EQ01', bomItemCode: 'BI01', bomItemName: 'Bolt' } as any;
      const created = { ...dto } as EquipBomItem;
      mockBomItemRepo.findOne.mockResolvedValue(null);
      mockBomItemRepo.create.mockReturnValue(created);
      mockBomItemRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.createItem(dto, 'COMP', 'PLT');

      // Assert
      expect(result).toEqual(created);
      // createItem은 dto 필드 외에 unit/useYn/stockQty/safetyStock 기본값을 채워 넣는다.
      expect(mockBomItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          equipCode: 'EQ01',
          bomItemCode: 'BI01',
          bomItemName: 'Bolt',
          unit: 'EA',
          useYn: 'Y',
          stockQty: 0,
          safetyStock: 0,
          company: 'COMP',
          plant: 'PLT',
        }),
      );
    });

    it('should reject duplicate item code within tenant', async () => {
      const dto = { equipCode: 'EQ01', bomItemCode: 'BI01', bomItemName: 'Bolt' } as any;
      mockBomItemRepo.findOne.mockResolvedValue({ equipCode: 'EQ01', bomItemCode: 'BI01', company: 'COMP', plant: 'PLT' } as EquipBomItem);

      await expect(target.createItem(dto, 'COMP', 'PLT')).rejects.toThrow(ConflictException);
      expect(mockBomItemRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('should update and return item', async () => {
      // Arrange
      const existing = { equipCode: 'EQ01', bomItemCode: 'BI01', bomItemName: 'Old' } as EquipBomItem;
      mockBomItemRepo.findOne.mockResolvedValue(existing);
      mockBomItemRepo.save.mockResolvedValue({ ...existing, bomItemName: 'New' } as EquipBomItem);

      // Act
      const result = await target.updateItem('EQ01', 'BI01', { bomItemName: 'New' } as any);

      // Assert
      expect(result.bomItemName).toBe('New');
    });

    it('should keep tenant and item key columns from the matched item when update payload contains them', async () => {
      const existing = { equipCode: 'EQ01', bomItemCode: 'BI01', bomItemName: 'Old', company: 'C1', plant: 'P1' } as EquipBomItem;
      mockBomItemRepo.findOne.mockResolvedValue(existing);
      mockBomItemRepo.save.mockImplementation(async (value) => value as EquipBomItem);

      const result = await target.updateItem('EQ01', 'BI01', {
        bomItemCode: 'BI99',
        bomItemName: 'New',
        company: 'C2',
        plant: 'P2',
      } as any, 'C1', 'P1');

      expect(result).toEqual(expect.objectContaining({
        bomItemCode: 'BI01',
        bomItemName: 'New',
        company: 'C1',
        plant: 'P1',
      }));
    });
  });

  describe('deleteItem', () => {
    it('should remove item', async () => {
      // Arrange
      const existing = { equipCode: 'EQ01', bomItemCode: 'BI01' } as EquipBomItem;
      mockBomItemRepo.findOne.mockResolvedValue(existing);
      mockBomItemRepo.remove.mockResolvedValue(existing);

      // Act & Assert
      await expect(target.deleteItem('EQ01', 'BI01')).resolves.toBeUndefined();
      expect(mockBomItemRepo.remove).toHaveBeenCalledWith(existing);
    });
  });

  // ─── BOM Rel CRUD ───

  describe('findRelByCompositeKey', () => {
    it('should return rel when found', async () => {
      // Arrange
      const rel = { equipCode: 'EQ01', bomItemCode: 'BI01' } as EquipBomRel;
      mockBomRelRepo.findOne.mockResolvedValue(rel);

      // Act
      const result = await target.findRelByCompositeKey('EQ01', 'BI01');

      // Assert
      expect(result).toEqual(rel);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockBomRelRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findRelByCompositeKey('EQ01', 'BI99')).rejects.toThrow(NotFoundException);
    });

    it('should find relation within tenant only', async () => {
      mockBomRelRepo.findOne.mockResolvedValue({ equipCode: 'EQ01', bomItemCode: 'BI01' } as EquipBomRel);

      await target.findRelByCompositeKey('EQ01', 'BI01', 'C1', 'P1');

      expect(mockBomRelRepo.findOne).toHaveBeenCalledWith({
        where: { equipCode: 'EQ01', bomItemCode: 'BI01', company: 'C1', plant: 'P1' },
        relations: ['equipment', 'bomItem'],
      });
    });
  });

  describe('createRel', () => {
    it('should create and return relation', async () => {
      // Arrange
      const dto = { equipCode: 'EQ01', bomItemId: 'BI01', quantity: 5 } as any;
      const created = { equipCode: 'EQ01', bomItemCode: 'BI01', quantity: 5 } as EquipBomRel;
      mockBomRelRepo.findOne.mockResolvedValue(null);
      mockBomRelRepo.create.mockReturnValue(created);
      mockBomRelRepo.save.mockResolvedValue(created);

      // Act
      const result = await target.createRel(dto, 'COMP', 'PLT');

      // Assert
      expect(result).toEqual(created);
    });

    it('should reject duplicate equipment and BOM item relation within tenant', async () => {
      const dto = { equipCode: 'EQ01', bomItemId: 'BI01', quantity: 5 } as any;
      mockBomRelRepo.findOne.mockResolvedValue({ equipCode: 'EQ01', bomItemCode: 'BI01', company: 'COMP', plant: 'PLT' } as EquipBomRel);

      await expect(target.createRel(dto, 'COMP', 'PLT')).rejects.toThrow(ConflictException);
      expect(mockBomRelRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('updateRel', () => {
    it('should update and return relation', async () => {
      // Arrange
      const existing = { equipCode: 'EQ01', bomItemCode: 'BI01', quantity: 5 } as EquipBomRel;
      mockBomRelRepo.findOne.mockResolvedValue(existing);
      mockBomRelRepo.save.mockResolvedValue({ ...existing, quantity: 10 } as EquipBomRel);

      // Act
      const result = await target.updateRel('EQ01', 'BI01', { quantity: 10 } as any);

      // Assert
      expect(result.quantity).toBe(10);
    });
  });

  describe('deleteRel', () => {
    it('should remove relation', async () => {
      // Arrange
      const existing = { equipCode: 'EQ01', bomItemCode: 'BI01' } as EquipBomRel;
      mockBomRelRepo.findOne.mockResolvedValue(existing);
      mockBomRelRepo.remove.mockResolvedValue(existing);

      // Act & Assert
      await expect(target.deleteRel('EQ01', 'BI01')).resolves.toBeUndefined();
    });
  });

  // ─── getEquipBomList ───
  describe('getEquipBomList', () => {
    it('should return mapped bom list for equipment', async () => {
      // Arrange
      const rels = [
        {
          equipCode: 'EQ01',
          bomItemCode: 'BI01',
          quantity: 5,
          installDate: null,
          expireDate: null,
          remark: null,
          useYn: 'Y',
          bomItem: {
            bomItemCode: 'BI01',
            bomItemName: 'Bolt',
            itemType: 'PART',
            spec: 'M8x20',
            maker: 'Maker1',
            unit: 'EA',
            unitPrice: 100,
            replacementCycle: 30,
            stockQty: 50,
            safetyStock: 10,
          },
        },
      ] as any;
      mockBomRelRepo.find.mockResolvedValue(rels);

      // Act
      const result = await target.getEquipBomList('EQ01', 'C1', 'P1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].bomItem.bomItemCode).toBe('BI01');
      expect(result[0].bomItem.bomItemName).toBe('Bolt');
      expect(mockBomRelRepo.find).toHaveBeenCalledWith({
        where: { equipCode: 'EQ01', useYn: 'Y', company: 'C1', plant: 'P1' },
        relations: ['bomItem'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when no rels found', async () => {
      // Arrange
      mockBomRelRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.getEquipBomList('EQ01');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─── findRelsByEquipId ───
  describe('findRelsByEquipId', () => {
    it('should return active rels for equipment', async () => {
      // Arrange
      const rels = [{ equipCode: 'EQ01', bomItemCode: 'BI01' }] as EquipBomRel[];
      mockBomRelRepo.find.mockResolvedValue(rels);

      // Act
      const result = await target.findRelsByEquipId('EQ01', 'C1', 'P1');

      // Assert
      expect(result).toEqual(rels);
      expect(mockBomRelRepo.find).toHaveBeenCalledWith({
        where: { equipCode: 'EQ01', useYn: 'Y', company: 'C1', plant: 'P1' },
        relations: ['bomItem'],
        order: { createdAt: 'DESC' },
      });
    });
  });
});
