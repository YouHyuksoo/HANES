/**
 * @file src/modules/menu-favorites/services/menu-favorites.service.ts
 * @description 사용자별 사이드바 메뉴 즐겨찾기 서비스
 *
 * 초보자 가이드:
 * 1. 저장 단위는 (COMPANY, PLANT_CD, USER_EMAIL) — 같은 사용자라도 사업장이 다르면 별도 목록
 * 2. replaceMine은 전체 교체(delete + insert) — 배열 순서를 SORT_ORDER(10단위)로 저장
 * 3. 메뉴 코드는 menu-code-validator 화이트리스트를 통과해야 함 (미지 코드 400)
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { UserMenuFavorite } from '../../../entities/user-menu-favorite.entity';
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
      await repo.delete({
        company: scope.company,
        plantCd: scope.plantCd,
        userEmail: scope.userEmail,
      });
      if (deduped.length === 0) return;
      const entities = deduped.map((menuCode, index) =>
        repo.create({
          company: scope.company,
          plantCd: scope.plantCd,
          userEmail: scope.userEmail,
          menuCode,
          sortOrder: (index + 1) * 10,
          createdAt: now,
          createdBy: scope.userEmail,
          updatedAt: now,
          updatedBy: scope.userEmail,
        }),
      );
      await repo.save(entities);
    });

    return deduped;
  }
}
