import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, getMetadataArgsStorage } from 'typeorm';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { MenuCategory } from '../../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../../entities/menu-category-item.entity';
import { MenuCategoriesService } from './menu-categories.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('MenuCategoriesService', () => {
  let service: MenuCategoriesService;
  let categoryRepo: jest.Mocked<Repository<MenuCategory>>;
  let itemRepo: jest.Mocked<Repository<MenuCategoryItem>>;
  let dataSource: jest.Mocked<DataSource>;
  let tx: jest.Mocked<TransactionService>;

  beforeEach(async () => {
    categoryRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn((x: any) => x),
    } as unknown as jest.Mocked<Repository<MenuCategory>>;

    itemRepo = {
      find: jest.fn(),
      count: jest.fn(),
    } as unknown as jest.Mocked<Repository<MenuCategoryItem>>;

    dataSource = {
      transaction: jest.fn(async (cb: any) => cb({ getRepository: () => categoryRepo })),
    } as unknown as jest.Mocked<DataSource>;
    tx = {
      run: jest.fn(async (cb: any) => cb({ manager: { getRepository: () => categoryRepo } })),
    } as unknown as jest.Mocked<TransactionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuCategoriesService,
        { provide: getRepositoryToken(MenuCategory), useValue: categoryRepo },
        { provide: getRepositoryToken(MenuCategoryItem), useValue: itemRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
      ],
    }).compile();

    service = module.get<MenuCategoriesService>(MenuCategoriesService);
  });

  describe('create', () => {
    it('유효한 카테고리를 생성한다', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      categoryRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.create(
        { code: 'NEW_CAT', labelKey: 'menu.newCat' },
        { company: 'C1', plantCd: 'P1', userId: 'tester' },
      );
      expect(result.categoryCode).toBe('NEW_CAT');
      expect(categoryRepo.save).toHaveBeenCalled();
    });

    it('checks duplicate category codes within tenant scope', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      categoryRepo.save.mockImplementation(async (e: any) => e);

      await service.create(
        { code: 'NEW_CAT', labelKey: 'menu.newCat' },
        { company: 'C1', plantCd: 'P1', userId: 'tester' },
      );

      expect(categoryRepo.findOne).toHaveBeenCalledWith({
        where: { categoryCode: 'NEW_CAT', company: 'C1', plantCd: 'P1' },
      });
    });

    it('예약어 __ROOT__ 생성 시 BadRequest', async () => {
      await expect(
        service.create(
          { code: '__ROOT__', labelKey: 'x' } as any,
          { company: 'C1', plantCd: 'P1', userId: 'tester' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('중복 코드 생성 시 Conflict', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'X' } as any);
      await expect(
        service.create(
          { code: 'X', labelKey: 'x' },
          { company: 'C1', plantCd: 'P1', userId: 'tester' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('delete', () => {
    it('비어있는 카테고리는 삭제된다', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'X' } as any);
      itemRepo.count.mockResolvedValueOnce(0);
      categoryRepo.delete.mockResolvedValueOnce({} as any);

      await service.delete('X');
      expect(categoryRepo.delete).toHaveBeenCalledWith({ categoryCode: 'X' });
    });

    it('자식 메뉴가 있으면 Conflict 한국어 메시지', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ categoryCode: 'X' } as any);
      itemRepo.count.mockResolvedValueOnce(3);

      await expect(service.delete('X')).rejects.toThrow(
        '카테고리에 메뉴가 3개 있습니다. 먼저 다른 카테고리로 이동하거나 삭제해주세요',
      );
    });

    it('__ROOT__는 삭제 차단', async () => {
      await expect(service.delete('__ROOT__')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('존재하지 않으면 NotFound', async () => {
      categoryRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.delete('X')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('tenant keys', () => {
    it('includes company and plantCd in MenuCategory primary key metadata', () => {
      const primaryColumnNames = getMetadataArgsStorage()
        .columns
        .filter(column => column.target === MenuCategory && column.options.primary)
        .map(column => column.propertyName);

      expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plantCd', 'categoryCode']));
    });
  });

  describe('reorder', () => {
    it('카테고리 순서 일괄 갱신', async () => {
      categoryRepo.update.mockResolvedValue({} as any);
      await service.reorder({ items: [{ code: 'A', sortOrder: 10 }, { code: 'B', sortOrder: 20 }] });
      expect(tx.run).toHaveBeenCalled();
    });
  });
});
