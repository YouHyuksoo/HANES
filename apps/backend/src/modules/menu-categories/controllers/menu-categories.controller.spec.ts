import { MenuCategoriesController } from './menu-categories.controller';
import { MenuCategoriesService } from '../services/menu-categories.service';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';
import { BadRequestException } from '@nestjs/common';

describe('MenuCategoriesController', () => {
  it('create maps JwtAuthGuard user.plant to menu category plantCd scope', async () => {
    const categories = {
      create: jest.fn().mockResolvedValue({ categoryCode: 'CAT-1' }),
    } as unknown as MenuCategoriesService;
    const items = {} as MenuCategoryItemsService;
    const controller = new MenuCategoriesController(categories, items);

    await controller.create({ categoryCode: 'CAT-1', labelKey: 'menu.cat', iconName: 'Menu' } as any, {
      user: { company: 'C1', plant: 'P1', userId: 'tester' },
    });

    expect(categories.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ company: 'C1', plantCd: 'P1', userId: 'tester' }),
    );
  });

  it('create rejects missing tenant instead of silently defaulting scope', async () => {
    const categories = {
      create: jest.fn(),
    } as unknown as MenuCategoriesService;
    const items = {} as MenuCategoryItemsService;
    const controller = new MenuCategoriesController(categories, items);

    await expect(
      controller.create({ categoryCode: 'CAT-1', labelKey: 'menu.cat', iconName: 'Menu' } as any, {
        user: { userId: 'tester' },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(categories.create).not.toHaveBeenCalled();
  });

  it('create uses JwtAuthGuard user id when userId is absent', async () => {
    const categories = {
      create: jest.fn().mockResolvedValue({ categoryCode: 'CAT-1' }),
    } as unknown as MenuCategoriesService;
    const items = {} as MenuCategoryItemsService;
    const controller = new MenuCategoriesController(categories, items);

    await controller.create({ categoryCode: 'CAT-1', labelKey: 'menu.cat', iconName: 'Menu' } as any, {
      user: { id: 'tester@test.com', company: 'C1', plant: 'P1' },
    });

    expect(categories.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ company: 'C1', plantCd: 'P1', userId: 'tester@test.com' }),
    );
  });
});
