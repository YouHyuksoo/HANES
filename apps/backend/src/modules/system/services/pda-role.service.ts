/**
 * @file services/pda-role.service.ts
 * @description PDA 역할 관리 서비스 — 역할 CRUD + 메뉴 매핑 일괄 관리
 *
 * 초보자 가이드:
 * 1. findAll: 역할 목록 + menus relation 조회
 * 2. create: 역할 생성 후 menuCodes로 PdaRoleMenu INSERT
 * 3. update: 역할 수정 + menuCodes 전체 교체 (delete → insert)
 * 4. remove: CASCADE로 메뉴 매핑까지 삭제
 * 5. getMenuCodes: 프론트 체크박스용 전체 메뉴코드 상수 반환
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PdaRole } from '../../../entities/pda-role.entity';
import { PdaRoleMenu } from '../../../entities/pda-role-menu.entity';
import { CreatePdaRoleDto, UpdatePdaRoleDto } from '../dto/pda-role.dto';

/** PDA 메뉴 코드 상수 — pdaMenuConfig.ts의 menuCode와 일치해야 함 */
export const PDA_MENU_CODES = [
  { code: 'PDA_MAT_RECEIVING', label: '자재 입고' },
  { code: 'PDA_MAT_ISSUING', label: '자재 불출' },
  { code: 'PDA_MAT_ADJUSTMENT', label: '자재 조정' },
  { code: 'PDA_MAT_INV_COUNT', label: '자재 재고실사' },
  { code: 'PDA_SHIPPING', label: '출하' },
  { code: 'PDA_EQUIP_INSPECT', label: '설비 점검' },
  { code: 'PDA_PRODUCT_INV_COUNT', label: '제품 재고실사' },
];

@Injectable()
export class PdaRoleService {
  constructor(
    @InjectRepository(PdaRole)
    private readonly roleRepo: Repository<PdaRole>,
    @InjectRepository(PdaRoleMenu)
    private readonly menuRepo: Repository<PdaRoleMenu>,
    private readonly dataSource: DataSource,
  ) {}

  /** 전체 역할 목록 (메뉴 매핑 포함) */
  async findAll() {
    return this.roleRepo.find({
      relations: ['menus'],
      order: { createdAt: 'ASC' },
    });
  }

  /** 활성 역할 목록 (Select 옵션용 — code, name만) */
  async findAllActive() {
    return this.roleRepo.find({
      where: { isActive: true },
      select: ['code', 'name'],
      order: { name: 'ASC' },
    });
  }

  /** 사용 가능한 PDA 메뉴코드 목록 */
  getMenuCodes() {
    return PDA_MENU_CODES;
  }

  /** 역할 생성 + 메뉴 매핑 */
  async create(dto: CreatePdaRoleDto) {
    const existing = await this.roleRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`이미 존재하는 역할 코드입니다: ${dto.code}`);
    }

    return this.dataSource.transaction(async (manager) => {
      const role = manager.create(PdaRole, {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        isActive: true,
      });
      await manager.save(role);

      if (dto.menuCodes?.length) {
        const menus = dto.menuCodes.map((menuCode) =>
          manager.create(PdaRoleMenu, {
            pdaRoleCode: dto.code,
            menuCode,
            isActive: true,
          }),
        );
        await manager.save(menus);
      }

      return this.roleRepo.findOne({
        where: { code: dto.code },
        relations: ['menus'],
      });
    });
  }

  /** 역할 수정 + 메뉴 매핑 전체 교체 */
  async update(code: string, dto: UpdatePdaRoleDto) {
    const role = await this.roleRepo.findOne({ where: { code } });
    if (!role) throw new NotFoundException(`역할을 찾을 수 없습니다: ${code}`);

    return this.dataSource.transaction(async (manager) => {
      const updateData: Partial<PdaRole> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      if (Object.keys(updateData).length > 0) {
        await manager.update(PdaRole, { code }, updateData);
      }

      if (dto.menuCodes !== undefined) {
        await manager.delete(PdaRoleMenu, { pdaRoleCode: code });

        if (dto.menuCodes.length > 0) {
          const menus = dto.menuCodes.map((menuCode) =>
            manager.create(PdaRoleMenu, {
              pdaRoleCode: code,
              menuCode,
              isActive: true,
            }),
          );
          await manager.save(menus);
        }
      }

      return this.roleRepo.findOne({
        where: { code },
        relations: ['menus'],
      });
    });
  }

  /** 역할 삭제 (CASCADE로 메뉴 매핑도 삭제) */
  async remove(code: string) {
    const role = await this.roleRepo.findOne({ where: { code } });
    if (!role) throw new NotFoundException(`역할을 찾을 수 없습니다: ${code}`);

    await this.roleRepo.delete({ code });
    return { code, deleted: true };
  }
}
