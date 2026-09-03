import { MenuFavoritesController } from './menu-favorites.controller';
import { MenuFavoritesService } from '../services/menu-favorites.service';
import { BadRequestException } from '@nestjs/common';

describe('MenuFavoritesController', () => {
  it('findMine maps user email and tenant to favorite scope', async () => {
    const service = {
      findMine: jest.fn().mockResolvedValue(['MST_PART']),
    } as unknown as MenuFavoritesService;
    const controller = new MenuFavoritesController(service);

    const result = await controller.findMine({
      user: { id: 'tester@test.com', email: 'tester@test.com', company: 'C1', plant: 'P1' },
    } as never);

    expect(service.findMine).toHaveBeenCalledWith({
      company: 'C1',
      plantCd: 'P1',
      userEmail: 'tester@test.com',
    });
    expect(result.data).toEqual(['MST_PART']);
  });

  it('replaceMine passes menuCodes in order with scope', async () => {
    const service = {
      replaceMine: jest.fn().mockResolvedValue(['PROD_ORDER', 'MST_PART']),
    } as unknown as MenuFavoritesService;
    const controller = new MenuFavoritesController(service);

    await controller.replaceMine({ menuCodes: ['PROD_ORDER', 'MST_PART'] }, {
      user: { id: 'tester@test.com', email: 'tester@test.com', company: 'C1', plant: 'P1' },
    } as never);

    expect(service.replaceMine).toHaveBeenCalledWith(
      ['PROD_ORDER', 'MST_PART'],
      expect.objectContaining({ company: 'C1', plantCd: 'P1', userEmail: 'tester@test.com' }),
    );
  });

  it('rejects missing tenant/user info instead of silently defaulting scope', async () => {
    const service = { findMine: jest.fn() } as unknown as MenuFavoritesService;
    const controller = new MenuFavoritesController(service);

    await expect(
      controller.findMine({ user: { email: 'tester@test.com' } } as never),
    ).rejects.toThrow(BadRequestException);

    expect(service.findMine).not.toHaveBeenCalled();
  });
});
