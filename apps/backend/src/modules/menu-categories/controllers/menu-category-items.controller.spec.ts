import { MenuCategoryItemsController } from './menu-category-items.controller';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';
import { BadRequestException } from '@nestjs/common';

describe('MenuCategoryItemsController', () => {
  it('move maps JwtAuthGuard user plant and id to menu item scope', async () => {
    const items = {
      move: jest.fn().mockResolvedValue({ menuCode: 'menu.dashboard' }),
    } as unknown as MenuCategoryItemsService;
    const controller = new MenuCategoryItemsController(items);

    await controller.move({ menuCode: 'menu.dashboard', categoryCode: 'CAT-1', sortOrder: 1 } as any, {
      user: { id: 'tester@test.com', company: 'C1', plant: 'P1' },
    } as any);

    expect(items.move).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ company: 'C1', plantCd: 'P1', userId: 'tester@test.com' }),
    );
  });

  it('move rejects missing tenant instead of silently defaulting scope', async () => {
    const items = {
      move: jest.fn(),
    } as unknown as MenuCategoryItemsService;
    const controller = new MenuCategoryItemsController(items);

    await expect(
      controller.move({ menuCode: 'menu.dashboard', categoryCode: 'CAT-1', sortOrder: 1 } as any, {
        user: { id: 'tester@test.com' },
      } as any),
    ).rejects.toThrow(BadRequestException);

    expect(items.move).not.toHaveBeenCalled();
  });
});
