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
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
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
  { code: 'PDA_PALLET_BUILD', label: '팔레트 구성' },
  { code: 'PDA_PALLET_SHIP', label: '팔레트 출하' },
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
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private requireTenant(company?: string | null, plant?: string | null) {
    if (!company || !plant) {
      throw new BadRequestException('회사/사업장 정보가 없습니다.');
    }
    return { company, plant };
  }

  /** 전체 역할 목록 (메뉴 매핑 포함) */
  async findAll(company?: string, plant?: string) {
    return this.roleRepo.find({
      where: this.tenantWhere(company, plant),
      relations: ['menus'],
      order: { createdAt: 'ASC' },
    });
  }

  /** 활성 역할 목록 (Select 옵션용 — code, name만) */
  async findAllActive(company?: string, plant?: string) {
    return this.roleRepo.find({
      where: { isActive: true, ...this.tenantWhere(company, plant) },
      select: ['code', 'name'],
      order: { name: 'ASC' },
    });
  }

  /** 사용 가능한 PDA 메뉴코드 목록 */
  getMenuCodes() {
    return PDA_MENU_CODES;
  }

  /** 역할 생성 + 메뉴 매핑 */
  async create(dto: CreatePdaRoleDto, company?: string, plant?: string) {
    const tenant = this.requireTenant(company, plant);
    const existing = await this.roleRepo.findOne({ where: { code: dto.code, ...tenant } });
    if (existing) {
      throw new ConflictException(`이미 존재하는 역할 코드입니다: ${dto.code}`);
    }

    return this.tx.run(async (queryRunner) => {
      const role = queryRunner.manager.create(PdaRole, {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        isActive: true,
        company: tenant.company,
        plant: tenant.plant,
      });
      await queryRunner.manager.save(role);

      if (dto.menuCodes?.length) {
        const menus = dto.menuCodes.map((menuCode) =>
          queryRunner.manager.create(PdaRoleMenu, {
            pdaRoleCode: dto.code,
            menuCode,
            isActive: true,
            company: tenant.company,
            plant: tenant.plant,
          }),
        );
        await queryRunner.manager.save(menus);
      }

      return this.roleRepo.findOne({
        where: { code: dto.code, ...tenant },
        relations: ['menus'],
      });
    });
  }

  /** 역할 수정 + 메뉴 매핑 전체 교체 */
  async update(code: string, dto: UpdatePdaRoleDto, company?: string, plant?: string) {
    const tenant = this.requireTenant(company, plant);
    const role = await this.roleRepo.findOne({ where: { code, ...tenant } });
    if (!role) throw new NotFoundException(`역할을 찾을 수 없습니다: ${code}`);

    return this.tx.run(async (queryRunner) => {
      const updateData: Partial<PdaRole> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(PdaRole, { code, ...tenant }, updateData);
      }

      if (dto.menuCodes !== undefined) {
        await queryRunner.manager.delete(PdaRoleMenu, { pdaRoleCode: code, ...tenant });

        if (dto.menuCodes.length > 0) {
          const menus = dto.menuCodes.map((menuCode) =>
            queryRunner.manager.create(PdaRoleMenu, {
              pdaRoleCode: code,
              menuCode,
              isActive: true,
              company: tenant.company,
              plant: tenant.plant,
            }),
          );
          await queryRunner.manager.save(menus);
        }
      }

      return this.roleRepo.findOne({
        where: { code, ...tenant },
        relations: ['menus'],
      });
    });
  }

  /** 역할 삭제 (CASCADE로 메뉴 매핑도 삭제) */
  async remove(code: string, company?: string, plant?: string) {
    const role = await this.roleRepo.findOne({ where: { code, ...this.tenantWhere(company, plant) } });
    if (!role) throw new NotFoundException(`역할을 찾을 수 없습니다: ${code}`);

    await this.roleRepo.delete({ code, ...this.tenantWhere(company, plant) });
    return { code, deleted: true };
  }
}
