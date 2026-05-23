import { MenuCategoryItemsController } from './menu-category-items.controller';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';

describe('MenuCategoryItemsController', () => {
  it('move maps JwtAuthGuard user.plant to menu item plantCd scope', async () => {
    const items = {
      move: jest.fn().mockResolvedValue({ menuCode: 'menu.dashboard' }),
    } as unknown as MenuCategoryItemsService;
    const controller = new MenuCategoryItemsController(items);

    await controller.move({ menuCode: 'menu.dashboard', categoryCode: 'CAT-1', sortOrder: 1 } as any, {
      user: { company: 'C1', plant: 'P1', userId: 'tester' },
    });

    expect(items.move).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ company: 'C1', plantCd: 'P1', userId: 'tester' }),
    );
  });
});
