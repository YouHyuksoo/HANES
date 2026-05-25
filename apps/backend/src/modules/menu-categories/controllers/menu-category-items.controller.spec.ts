import { MenuCategoryItemsController } from './menu-category-items.controller';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';
import { BadRequestException } from '@nestjs/common';

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

  it('move rejects missing tenant instead of silently defaulting scope', async () => {
    const items = {
      move: jest.fn(),
    } as unknown as MenuCategoryItemsService;
    const controller = new MenuCategoryItemsController(items);

    await expect(
      controller.move({ menuCode: 'menu.dashboard', categoryCode: 'CAT-1', sortOrder: 1 } as any, {
        user: { userId: 'tester' },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(items.move).not.toHaveBeenCalled();
  });

  it('move uses JwtAuthGuard user id when userId is absent', async () => {
    const items = {
      move: jest.fn().mockResolvedValue({ menuCode: 'menu.dashboard' }),
    } as unknown as MenuCategoryItemsService;
    const controller = new MenuCategoryItemsController(items);

    await controller.move({ menuCode: 'menu.dashboard', categoryCode: 'CAT-1', sortOrder: 1 } as any, {
      user: { id: 'tester@test.com', company: 'C1', plant: 'P1' },
    });

    expect(items.move).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ company: 'C1', plantCd: 'P1', userId: 'tester@test.com' }),
    );
  });
});
