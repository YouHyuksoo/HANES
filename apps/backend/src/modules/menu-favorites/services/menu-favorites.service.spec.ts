import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MenuFavoritesService, FavoriteScope } from './menu-favorites.service';
import { UserMenuFavorite } from '../../../entities/user-menu-favorite.entity';
import { TransactionService } from '../../../shared/transaction.service';

const scope: FavoriteScope = { company: 'C1', plantCd: 'P1', userEmail: 'tester@test.com' };

describe('MenuFavoritesService', () => {
  const buildTxRepo = () => ({
    delete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((v: Partial<UserMenuFavorite>) => v),
    save: jest.fn().mockResolvedValue(undefined),
  });

  const buildService = (txRepo: ReturnType<typeof buildTxRepo>, findResult: UserMenuFavorite[] = []) => {
    const favoriteRepo = {
      find: jest.fn().mockResolvedValue(findResult),
    } as unknown as Repository<UserMenuFavorite>;
    const tx = {
      run: jest.fn(async (fn: (qr: unknown) => Promise<void>) =>
        fn({ manager: { getRepository: () => txRepo } }),
      ),
    } as unknown as TransactionService;
    return new MenuFavoritesService(favoriteRepo, tx);
  };

  it('findMine returns menu codes ordered by sortOrder', async () => {
    const rows = [
      { menuCode: 'PROD_ORDER', sortOrder: 10 },
      { menuCode: 'MST_PART', sortOrder: 20 },
    ] as UserMenuFavorite[];
    const service = buildService(buildTxRepo(), rows);

    await expect(service.findMine(scope)).resolves.toEqual(['PROD_ORDER', 'MST_PART']);
  });

  it('replaceMine deletes existing rows and inserts with 10-step sortOrder', async () => {
    const txRepo = buildTxRepo();
    const service = buildService(txRepo);

    const result = await service.replaceMine(['PROD_ORDER', 'MST_PART'], scope);

    expect(txRepo.delete).toHaveBeenCalledWith({
      company: 'C1',
      plantCd: 'P1',
      userEmail: 'tester@test.com',
    });
    expect(txRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ menuCode: 'PROD_ORDER', sortOrder: 10, userEmail: 'tester@test.com' }),
      expect.objectContaining({ menuCode: 'MST_PART', sortOrder: 20 }),
    ]);
    expect(result).toEqual(['PROD_ORDER', 'MST_PART']);
  });

  it('replaceMine deduplicates codes preserving first occurrence order', async () => {
    const txRepo = buildTxRepo();
    const service = buildService(txRepo);

    const result = await service.replaceMine(['MST_PART', 'PROD_ORDER', 'MST_PART'], scope);

    expect(result).toEqual(['MST_PART', 'PROD_ORDER']);
  });

  it('replaceMine with empty array clears favorites without inserting', async () => {
    const txRepo = buildTxRepo();
    const service = buildService(txRepo);

    await expect(service.replaceMine([], scope)).resolves.toEqual([]);
    expect(txRepo.delete).toHaveBeenCalled();
    expect(txRepo.save).not.toHaveBeenCalled();
  });

  it('replaceMine rejects unknown menu codes', async () => {
    const txRepo = buildTxRepo();
    const service = buildService(txRepo);

    await expect(service.replaceMine(['NOT_A_MENU'], scope)).rejects.toThrow(BadRequestException);
    expect(txRepo.delete).not.toHaveBeenCalled();
  });
});
