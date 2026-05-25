import { MenuCategoriesController } from './menu-categories.controller';
import { MenuCategoriesService } from '../services/menu-categories.service';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';
import { BadRequestException } from '@nestjs/common';

describe('MenuCategoriesController', () => {
  it('create maps JwtAuthGuard user plant and id to menu category scope', async () => {
    const categories = {
      create: jest.fn().mockResolvedValue({ categoryCode: 'CAT-1' }),
    } as unknown as MenuCategoriesService;
    const items = {} as MenuCategoryItemsService;
    const controller = new MenuCategoriesController(categories, items);

    await controller.create({ categoryCode: 'CAT-1', labelKey: 'menu.cat', iconName: 'Menu' } as any, {
      user: { id: 'tester@test.com', company: 'C1', plant: 'P1' },
    } as any);

    expect(categories.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ company: 'C1', plantCd: 'P1', userId: 'tester@test.com' }),
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
        user: { id: 'tester@test.com' },
      } as any),
    ).rejects.toThrow(BadRequestException);

    expect(categories.create).not.toHaveBeenCalled();
  });
});
