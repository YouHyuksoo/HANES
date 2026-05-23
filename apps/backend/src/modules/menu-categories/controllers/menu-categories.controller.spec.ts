import { MenuCategoriesController } from './menu-categories.controller';
import { MenuCategoriesService } from '../services/menu-categories.service';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';

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
});
