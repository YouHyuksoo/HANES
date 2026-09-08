/**
 * @file src/modules/menu-favorites/services/menu-favorites.service.ts
 * @description 사용자별 사이드바 메뉴 즐겨찾기 서비스
 *
 * 초보자 가이드:
 * 1. 저장 단위는 (COMPANY, PLANT_CD, USER_EMAIL) — 같은 사용자라도 사업장이 다르면 별도 목록
 * 2. replaceMine은 목록 동기화(기존 폴더 할당 보존) — 배열 순서를 SORT_ORDER(10단위)로 저장
 * 3. 메뉴 코드는 menu-code-validator 화이트리스트를 통과해야 함 (미지 코드 400)
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { UserMenuFavorite } from '../../../entities/user-menu-favorite.entity';
import { UserMenuFavoriteFolder } from '../../../entities/user-menu-favorite-folder.entity';
import { isValidMenuCode } from '../../menu-categories/utils/menu-code-validator';

export interface FavoriteScope {
  company: string;
  plantCd: string;
  userEmail: string;
}

@Injectable()
export class MenuFavoritesService {
  constructor(
    @InjectRepository(UserMenuFavorite)
    private readonly favoriteRepo: Repository<UserMenuFavorite>,
    private readonly tx: TransactionService,
  ) {}

  /** 내 즐겨찾기 메뉴 코드 목록 (SORT_ORDER 순) */
  async findMine(scope: FavoriteScope): Promise<string[]> {
    const rows = await this.favoriteRepo.find({
      where: { company: scope.company, plantCd: scope.plantCd, userEmail: scope.userEmail },
      order: { sortOrder: 'ASC', menuCode: 'ASC' },
    });
    return rows.map((r) => r.menuCode);
  }

  /** 내 즐겨찾기 전체 교체 — 배열 순서가 표시 순서 */
  async replaceMine(menuCodes: string[], scope: FavoriteScope): Promise<string[]> {
    const deduped = [...new Set(menuCodes)];
    const unknown = deduped.filter((code) => !isValidMenuCode(code));
    if (unknown.length > 0) {
      throw new BadRequestException(`알 수 없는 메뉴 코드입니다: ${unknown.join(', ')}`);
    }

    const now = new Date();
    await this.tx.run(async (queryRunner) => {
      const repo = queryRunner.manager.getRepository(UserMenuFavorite);
      const existing = await repo.find({ where: scope });
      const previous = new Map(existing.map(row => [row.menuCode, row]));
      // 남아 있는 메뉴는 sortOrder만 수정해 동시 폴더 이동/삭제 결과를 덮어쓰지 않는다.
      const removed = existing.filter(row => !deduped.includes(row.menuCode));
      for (const row of removed) await repo.delete({ ...scope, menuCode: row.menuCode });
      const inserted: UserMenuFavorite[] = [];
      for (const [index, menuCode] of deduped.entries()) {
        const sortOrder = (index + 1) * 10;
        if (previous.has(menuCode)) {
          await repo.update({ ...scope, menuCode }, { sortOrder, updatedAt: now, updatedBy: scope.userEmail });
        } else {
          inserted.push(repo.create({
            ...scope, menuCode, folderId: null, sortOrder,
            createdAt: now, createdBy: scope.userEmail, updatedAt: now, updatedBy: scope.userEmail,
          }));
        }
      }
      if (inserted.length) await repo.save(inserted);
    });

    return deduped;
  }

  /** 메뉴 배열 API와 별개로 그룹 정보만 제공해 기존 클라이언트 호환을 유지한다. */
  async findFolders(scope: FavoriteScope) {
    const [folders, favorites] = await Promise.all([
      this.favoriteRepo.manager.getRepository(UserMenuFavoriteFolder).find({
        where: scope, order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      this.favoriteRepo.find({ where: scope, order: { sortOrder: 'ASC', menuCode: 'ASC' } }),
    ]);
    return {
      folders: folders.map(({ id, name, sortOrder }) => ({ id, name, sortOrder })),
      assignments: favorites.map(({ menuCode, folderId }) => ({ menuCode, folderId: folderId ?? null })),
    };
  }

  private normalizedName(name: string) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      throw new BadRequestException('폴더명은 1~100자로 입력하세요.');
    }
    return name.trim();
  }

  private async ownedFolder(manager: EntityManager, id: number, scope: FavoriteScope) {
    if (!Number.isSafeInteger(id) || id < 1 || id > 999999999999999) {
      throw new BadRequestException('올바른 폴더 ID가 아닙니다.');
    }
    // Oracle는 FETCH FIRST/NEXT + FOR UPDATE를 허용하지 않는다.
    // findOne의 자동 take:1을 피하고 PK로 단건을 보장한다.
    const rows = await manager.query(
      'SELECT ID AS "id", NAME AS "name", SORT_ORDER AS "sortOrder" FROM USER_MENU_FAVORITE_FOLDERS ' +
      'WHERE ID = :1 AND COMPANY = :2 AND PLANT_CD = :3 AND USER_EMAIL = :4 FOR UPDATE',
      [id, scope.company, scope.plantCd, scope.userEmail],
    );
    const folder = rows[0];
    if (!folder) throw new NotFoundException('내 즐겨찾기 폴더를 찾을 수 없습니다.');
    return folder;
  }

  async createFolder(name: string, scope: FavoriteScope) {
    const normalized = this.normalizedName(name);
    return this.tx.run(async ({ manager }) => {
      const rows = await manager.query('SELECT SEQ_MENU_FAVORITE_FOLDER.NEXTVAL AS "id" FROM DUAL');
      const id = Number(rows[0].id);
      const repo = manager.getRepository(UserMenuFavoriteFolder);
      await repo.save(repo.create({ ...scope, id, name: normalized, sortOrder: id }));
      return { id, name: normalized, sortOrder: id };
    });
  }

  async renameFolder(id: number, name: string, scope: FavoriteScope) {
    const normalized = this.normalizedName(name);
    return this.tx.run(async ({ manager }) => {
      const folder = await this.ownedFolder(manager, id, scope);
      await manager.getRepository(UserMenuFavoriteFolder).update({ ...scope, id }, { name: normalized });
      return { id, name: normalized, sortOrder: folder.sortOrder };
    });
  }

  async deleteFolder(id: number, scope: FavoriteScope) {
    return this.tx.run(async ({ manager }) => {
      await this.ownedFolder(manager, id, scope);
      await manager.getRepository(UserMenuFavorite).update({ ...scope, folderId: id }, {
        folderId: null, updatedBy: scope.userEmail,
      });
      await manager.getRepository(UserMenuFavoriteFolder).delete({ ...scope, id });
      return { id };
    });
  }

  async assignFolder(menuCode: string, folderId: number | null, scope: FavoriteScope) {
    if (!isValidMenuCode(menuCode)) throw new BadRequestException('알 수 없는 메뉴 코드입니다.');
    return this.tx.run(async ({ manager }) => {
      if (folderId !== null) await this.ownedFolder(manager, folderId, scope);
      const result = await manager.getRepository(UserMenuFavorite).update({ ...scope, menuCode }, {
        folderId, updatedBy: scope.userEmail,
      });
      if (!result.affected) throw new NotFoundException('먼저 메뉴를 즐겨찾기에 추가하세요.');
      return { menuCode, folderId };
    });
  }
}
