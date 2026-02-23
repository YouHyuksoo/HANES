/**
 * @file src/modules/role/role.service.ts
 * @description 역할(Role) CRUD 및 메뉴 권한 관리 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: 역할 목록 조회 (company 필터 지원)
 * 2. **findOne**: 역할 상세 조회 (permissions 포함)
 * 3. **create/update/remove**: 역할 CRUD (isSystem 역할은 삭제 불가)
 * 4. **getPermissions**: 특정 역할의 허용된 메뉴 코드 배열 반환
 * 5. **updatePermissions**: 기존 권한 삭제 후 새로 INSERT (전체 교체 방식)
 * 6. **getAllowedMenusByRoleCode**: roleCode로 허용 메뉴 조회 (AuthService에서 호출)
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Role } from '../../entities/role.entity';
import { RoleMenuPermission } from '../../entities/role-menu-permission.entity';
import { CreateRoleDto, UpdateRoleDto, UpdatePermissionsDto } from './role.dto';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RoleMenuPermission)
    private readonly permissionRepository: Repository<RoleMenuPermission>,
  ) {}

  /** 역할 목록 조회 */
  async findAll(company?: string) {
    const where: Record<string, unknown> = {
      deletedAt: IsNull(),
      ...(company && { company }),
    };

    return this.roleRepository.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  /** 역할 상세 조회 (권한 포함) */
  async findOne(id: number) {
    const role = await this.roleRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('역할을 찾을 수 없습니다.');
    }

    return role;
  }

  /** 역할 생성 */
  async create(dto: CreateRoleDto, company?: string, userId?: string) {
    // code 중복 체크
    const existing = await this.roleRepository.findOne({
      where: { code: dto.code, deletedAt: IsNull() },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 역할 코드입니다: ${dto.code}`);
    }

    const role = this.roleRepository.create({
      code: dto.code,
      name: dto.name,
      description: dto.description || null,
      sortOrder: dto.sortOrder ?? 0,
      company: company || null,
      createdBy: userId || null,
    });

    const saved = await this.roleRepository.save(role);
    this.logger.log(`Role created: ${saved.code} (${saved.id})`);
    return saved;
  }

  /** 역할 수정 */
  async update(id: number, dto: UpdateRoleDto, userId?: string) {
    const role = await this.findOne(id);

    await this.roleRepository.update(id, {
      ...dto,
      updatedBy: userId || role.updatedBy,
    });

    const updated = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    this.logger.log(`Role updated: ${updated!.code} (${id})`);
    return updated;
  }

  /** 역할 삭제 (소프트 삭제) */
  async remove(id: number) {
    const role = await this.findOne(id);

    if (role.isSystem) {
      throw new BadRequestException('시스템 기본 역할은 삭제할 수 없습니다.');
    }

    await this.roleRepository.softDelete(id);
    this.logger.log(`Role deleted: ${role.code} (${id})`);
    return { message: '역할이 삭제되었습니다.' };
  }

  /** 특정 역할의 메뉴 권한 목록 조회 (메뉴 코드 배열) */
  async getPermissions(roleId: number): Promise<string[]> {
    const permissions = await this.permissionRepository.find({
      where: { roleId, canAccess: true },
    });

    return permissions.map((p) => p.menuCode);
  }

  /** 메뉴 권한 일괄 업데이트 (기존 삭제 후 새로 INSERT) */
  async updatePermissions(roleId: number, dto: UpdatePermissionsDto) {
    // ADMIN 역할은 권한 수정 불가 (모든 메뉴 접근 가능)
    const role = await this.findOne(roleId);
    if (role.code === 'ADMIN') {
      throw new BadRequestException(
        'ADMIN 역할의 권한은 수정할 수 없습니다. (모든 메뉴 접근 가능)',
      );
    }

    // 기존 권한 전체 삭제
    await this.permissionRepository.delete({ roleId });

    // 새 권한 INSERT
    const entities = dto.menuCodes.map((menuCode) =>
      this.permissionRepository.create({
        roleId,
        menuCode,
        canAccess: true,
      }),
    );

    await this.permissionRepository.save(entities);

    this.logger.log(
      `Permissions updated for role ${role.code}: ${dto.menuCodes.length} menus`,
    );

    return {
      roleId,
      menuCodes: dto.menuCodes,
      message: '메뉴 권한이 업데이트되었습니다.',
    };
  }

  /**
   * roleCode로 허용된 메뉴 목록 조회
   * - ADMIN이면 빈 배열 반환 (프론트에서 빈 배열 = 모든 메뉴 허용으로 처리)
   * - AuthService.login()에서 호출됨
   */
  async getAllowedMenusByRoleCode(roleCode: string): Promise<string[]> {
    if (roleCode === 'ADMIN') {
      return [];
    }

    const role = await this.roleRepository.findOne({
      where: { code: roleCode, deletedAt: IsNull() },
    });

    if (!role) {
      return [];
    }

    const permissions = await this.permissionRepository.find({
      where: { roleId: role.id, canAccess: true },
    });

    return permissions.map((p) => p.menuCode);
  }
}
