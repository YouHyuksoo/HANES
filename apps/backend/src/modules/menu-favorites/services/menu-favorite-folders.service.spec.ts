import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { UserMenuFavorite } from '../../../entities/user-menu-favorite.entity';
import { UserMenuFavoriteFolder } from '../../../entities/user-menu-favorite-folder.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { MenuFavoritesService } from './menu-favorites.service';
import { AssignFavoriteFolderDto, FavoriteFolderNameDto } from '../dto/menu-favorite.dto';

const scope = { company: 'C1', plantCd: 'P1', userEmail: 'user@test.com' };

function fixture() {
  const favorite = {
    find: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }), create: jest.fn(v => v), save: jest.fn(),
  };
  const folder = {
    find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue({ ...scope, id: 7, name: '검사', sortOrder: 7 }),
    update: jest.fn(), delete: jest.fn(), create: jest.fn(v => v), save: jest.fn(),
  };
  const manager = {
    query: jest.fn().mockResolvedValue([{ id: 8 }]),
    getRepository: jest.fn(entity => entity === UserMenuFavoriteFolder ? folder : favorite),
  };
  const tx = { run: jest.fn(fn => fn({ manager })) };
  const repo = { ...favorite, manager };
  const service = new MenuFavoritesService(repo as unknown as Repository<UserMenuFavorite>, tx as unknown as TransactionService);
  return { favorite, folder, manager, tx, service };
}

describe('즐겨찾기 폴더', () => {
  it('목록은 사용자와 tenant 범위이며 API에 내부 소유자를 노출하지 않는다', async () => {
    const f = fixture();
    f.folder.find.mockResolvedValue([{ ...scope, id: 7, name: '검사', sortOrder: 7 }]);
    f.favorite.find.mockResolvedValue([{ ...scope, menuCode: 'MST_PART', folderId: 7 }]);
    expect(await f.service.findFolders(scope)).toEqual({
      folders: [{ id: 7, name: '검사', sortOrder: 7 }], assignments: [{ menuCode: 'MST_PART', folderId: 7 }],
    });
    expect(f.folder.find).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
    expect(f.favorite.find).toHaveBeenCalledWith(expect.objectContaining({ where: scope }));
  });

  it('폴더 생성은 sequence 채번 및 trim한 이름을 저장한다', async () => {
    const f = fixture();
    expect(await f.service.createFolder('  통합테스트  ', scope)).toEqual({ id: 8, name: '통합테스트', sortOrder: 8 });
    expect(f.manager.query).toHaveBeenCalledWith(expect.stringContaining('SEQ_MENU_FAVORITE_FOLDER.NEXTVAL'));
    expect(f.folder.save).toHaveBeenCalledWith(expect.objectContaining({ ...scope, name: '통합테스트' }));
  });

  it('다른 사용자/tenant 폴더로 이동하거나 수정·삭제할 수 없다', async () => {
    const f = fixture();
    f.manager.query.mockResolvedValue([]);
    await expect(f.service.assignFolder('MST_PART', 7, scope)).rejects.toThrow(NotFoundException);
    await expect(f.service.renameFolder(7, '변경', scope)).rejects.toThrow(NotFoundException);
    await expect(f.service.deleteFolder(7, scope)).rejects.toThrow(NotFoundException);
    expect(f.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ID = :1 AND COMPANY = :2 AND PLANT_CD = :3 AND USER_EMAIL = :4 FOR UPDATE'),
      [7, scope.company, scope.plantCd, scope.userEmail],
    );
    expect(f.favorite.update).not.toHaveBeenCalled();
    expect(f.folder.delete).not.toHaveBeenCalled();
  });

  it('폴더 삭제는 즐겨찾기를 루트로 이동한 후 같은 트랜잭션에서 폴더만 삭제한다', async () => {
    const f = fixture();
    await f.service.deleteFolder(7, scope);
    expect(f.tx.run).toHaveBeenCalledTimes(1);
    expect(f.favorite.update).toHaveBeenCalledWith({ ...scope, folderId: 7 }, { folderId: null, updatedBy: scope.userEmail });
    expect(f.folder.delete).toHaveBeenCalledWith({ ...scope, id: 7 });
    expect(f.favorite.delete).not.toHaveBeenCalled();
    expect(f.favorite.update.mock.invocationCallOrder[0]).toBeLessThan(f.folder.delete.mock.invocationCallOrder[0]);
  });

  it('루트 이동 실패시 폴더를 삭제하지 않는다', async () => {
    const f = fixture();
    f.favorite.update.mockRejectedValue(new Error('write failed'));
    await expect(f.service.deleteFolder(7, scope)).rejects.toThrow('write failed');
    expect(f.folder.delete).not.toHaveBeenCalled();
  });

  it('즐겨찾기 전체 목록 저장은 기존 폴더 할당을 덮어쓰지 않는다', async () => {
    const f = fixture();
    f.favorite.find.mockResolvedValue([{ ...scope, menuCode: 'MST_PART', folderId: 7 }]);
    await f.service.replaceMine(['PROD_ORDER', 'MST_PART'], scope);
    expect(f.favorite.update).toHaveBeenCalledWith({ ...scope, menuCode: 'MST_PART' }, expect.objectContaining({ sortOrder: 20 }));
    expect(f.favorite.update.mock.calls[0][1]).not.toHaveProperty('folderId');
    expect(f.favorite.delete).not.toHaveBeenCalled();
    expect(f.favorite.save).toHaveBeenCalledWith([expect.objectContaining({ menuCode: 'PROD_ORDER', folderId: null })]);
  });

  it('루트 이동은 folder null을 저장하며 즐겨찾기 아닌 메뉴는 거부한다', async () => {
    const f = fixture();
    expect(await f.service.assignFolder('MST_PART', null, scope)).toEqual({ menuCode: 'MST_PART', folderId: null });
    expect(f.folder.findOne).not.toHaveBeenCalled();
    f.favorite.update.mockResolvedValue({ affected: 0 });
    await expect(f.service.assignFolder('MST_PART', null, scope)).rejects.toThrow(NotFoundException);
    await expect(f.service.assignFolder('INVALID', 7, scope)).rejects.toThrow(BadRequestException);
  });

  it('폴더 ID는 양의 안전한 정수 또는 명시적 null만 허용한다', async () => {
    for (const folderId of [undefined, '7', -1, 0, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect((await validate(Object.assign(new AssignFavoriteFolderDto(), { folderId }))).length).toBeGreaterThan(0);
    }
    for (const folderId of [null, 7]) expect(await validate(Object.assign(new AssignFavoriteFolderDto(), { folderId }))).toHaveLength(0);
    expect((await validate(Object.assign(new FavoriteFolderNameDto(), { name: '  ' }))).length).toBeGreaterThan(0);
  });
});
