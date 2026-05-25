import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, getMetadataArgsStorage } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MenuCategory } from '../../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../../entities/menu-category-item.entity';
import { MenuCategoryItemsService } from './menu-category-items.service';
import { TransactionService } from '../../../shared/transaction.service';

jest.mock('../utils/menu-code-validator', () => ({
  isValidMenuCode: (code: string) => new Set(['DASHBOARD', 'MST_PART', 'MST_BOM', 'SYS_USER']).has(code),
  listKnownMenuCodes: () => ['DASHBOARD', 'MST_PART', 'MST_BOM', 'SYS_USER'],
}));

describe('MenuCategoryItemsService', () => {
  let service: MenuCategoryItemsService;
  let itemRepo: jest.Mocked<Repository<MenuCategoryItem>>;
  let categoryRepo: jest.Mocked<Repository<MenuCategory>>;
  let dataSource: jest.Mocked<DataSource>;
  let tx: jest.Mocked<TransactionService>;

  beforeEach(async () => {
    itemRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((x: any) => x),
    } as unknown as jest.Mocked<Repository<MenuCategoryItem>>;

    categoryRepo = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<MenuCategory>>;

    dataSource = {
      transaction: jest.fn(async (cb: any) => cb({ getRepository: () => itemRepo })),
    } as unknown as jest.Mocked<DataSource>;
    tx = {
      run: jest.fn(async (cb: any) => cb({ manager: { getRepository: () => itemRepo } })),
    } as unknown as jest.Mocked<TransactionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuCategoryItemsService,
        { provide: getRepositoryToken(MenuCategoryItem), useValue: itemRepo },
        { provide: getRepositoryToken(MenuCategory), useValue: categoryRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
      ],
    }).compile();

    service = module.get<MenuCategoryItemsService>(MenuCategoryItemsService);
  });

  describe('move', () => {
    it('메뉴를 다른 카테고리로 이동(신규 생성)', async () => {
      itemRepo.findOne.mockResolvedValueOnce(null);
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'TARGET' } as any);
      itemRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.move(
        { menuCode: 'MST_PART', toCategoryCode: 'TARGET', sortOrder: 10 },
        { company: 'C1', plantCd: 'P1', userId: 'tester' },
      );
      expect(result.menuCode).toBe('MST_PART');
      expect(result.categoryCode).toBe('TARGET');
      expect(categoryRepo.findOne).toHaveBeenCalledWith({
        where: { categoryCode: 'TARGET', company: 'C1', plantCd: 'P1' },
      });
      expect(itemRepo.findOne).toHaveBeenCalledWith({
        where: { menuCode: 'MST_PART', company: 'C1', plantCd: 'P1' },
      });
    });

    it('이미 다른 카테고리에 있으면 카테고리/순서 갱신', async () => {
      itemRepo.findOne.mockResolvedValueOnce({ menuCode: 'MST_PART', categoryCode: 'OLD' } as any);
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'TARGET' } as any);
      itemRepo.save.mockImplementation(async (e: any) => e);

      await service.move(
        { menuCode: 'MST_PART', toCategoryCode: 'TARGET', sortOrder: 20 },
        { company: 'C1', plantCd: 'P1', userId: 'tester' },
      );
      expect(itemRepo.save).toHaveBeenCalled();
    });

    it('존재하지 않는 menuCode는 BadRequest', async () => {
      await expect(
        service.move(
          { menuCode: 'NON_EXISTENT', toCategoryCode: 'X', sortOrder: 0 },
          { company: 'C1', plantCd: 'P1', userId: 'tester' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('존재하지 않는 카테고리는 NotFound', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.move(
          { menuCode: 'MST_PART', toCategoryCode: 'GONE', sortOrder: 0 },
          { company: 'C1', plantCd: 'P1', userId: 'tester' },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('매핑을 삭제하여 미배치 상태로 만든다', async () => {
      itemRepo.findOne.mockResolvedValueOnce({ menuCode: 'MST_PART' } as any);
      itemRepo.delete.mockResolvedValueOnce({} as any);

      await service.remove('MST_PART', { company: 'C1', plantCd: 'P1', userId: 'tester' });
      expect(itemRepo.findOne).toHaveBeenCalledWith({
        where: { menuCode: 'MST_PART', company: 'C1', plantCd: 'P1' },
      });
      expect(itemRepo.delete).toHaveBeenCalledWith({ menuCode: 'MST_PART', company: 'C1', plantCd: 'P1' });
    });

    it('매핑이 없으면 NotFound', async () => {
      itemRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.remove('MST_PART')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reorderInCategory', () => {
    it('카테고리 내 순서 일괄 갱신', async () => {
      itemRepo.update.mockResolvedValue({} as any);
      await service.reorderInCategory('CAT', {
        items: [
          { menuCode: 'MST_PART', sortOrder: 10 },
          { menuCode: 'MST_BOM', sortOrder: 20 },
        ],
      });
      expect(tx.run).toHaveBeenCalled();
    });
  });

  describe('tenant keys', () => {
    it('includes company and plantCd in MenuCategoryItem primary key metadata', () => {
      const primaryColumnNames = getMetadataArgsStorage()
        .columns
        .filter(column => column.target === MenuCategoryItem && column.options.primary)
        .map(column => column.propertyName);

      expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plantCd', 'menuCode']));
    });
  });
});
