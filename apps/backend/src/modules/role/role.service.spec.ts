/**
 * @file src/modules/role/role.service.spec.ts
 * @description RoleService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "RoleService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RoleService } from './role.service';
import { Role } from '../../entities/role.entity';
import { RoleMenuPermission } from '../../entities/role-menu-permission.entity';
import { MockLoggerService } from '../../common/test/mock-logger.service';

describe('RoleService', () => {
  let target: RoleService;
  let mockRoleRepo: DeepMocked<Repository<Role>>;
  let mockPermRepo: DeepMocked<Repository<RoleMenuPermission>>;

  beforeEach(async () => {
    mockRoleRepo = createMock<Repository<Role>>();
    mockPermRepo = createMock<Repository<RoleMenuPermission>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(RoleMenuPermission), useValue: mockPermRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<RoleService>(RoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return roles list', async () => {
      // Arrange
      const roles = [{ code: 'ADMIN' }] as Role[];
      mockRoleRepo.find.mockResolvedValue(roles);

      // Act
      const result = await target.findAll('COMP');

      // Assert
      expect(result).toEqual(roles);
    });
  });

  // ─── findOne ───
  describe('findOne', () => {
    it('should return role with permissions', async () => {
      // Arrange
      const role = { code: 'ADMIN', permissions: [] } as any;
      mockRoleRepo.findOne.mockResolvedValue(role);

      // Act
      const result = await target.findOne('ADMIN');

      // Assert
      expect(result).toEqual(role);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findOne('NONE')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create a new role', async () => {
      // Arrange
      const dto = { code: 'NEW', name: 'New Role' } as any;
      mockRoleRepo.findOne.mockResolvedValue(null);
      mockRoleRepo.create.mockReturnValue(dto as Role);
      mockRoleRepo.save.mockResolvedValue(dto as Role);

      // Act
      const result = await target.create(dto);

      // Assert
      expect(result).toEqual(dto);
    });

    it('should throw ConflictException when code exists', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue({ code: 'EXISTING' } as any);

      // Act & Assert
      await expect(target.create({ code: 'EXISTING' } as any)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update role', async () => {
      // Arrange
      const role = { code: 'ROLE1', permissions: [] } as any;
      mockRoleRepo.findOne.mockResolvedValue(role);
      mockRoleRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.update('ROLE1', { name: 'Updated' } as any);

      // Assert
      expect(result).toEqual(role);
    });
  });

  // ─── remove ───
  describe('remove', () => {
    it('should delete non-system role', async () => {
      // Arrange
      const role = { code: 'ROLE1', isSystem: false, permissions: [] } as any;
      mockRoleRepo.findOne.mockResolvedValue(role);
      mockRoleRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.remove('ROLE1');

      // Assert
      expect(result).toEqual({ message: '역할이 삭제되었습니다.' });
    });

    it('should throw BadRequestException for system role', async () => {
      // Arrange
      const role = { code: 'ADMIN', isSystem: true, permissions: [] } as any;
      mockRoleRepo.findOne.mockResolvedValue(role);

      // Act & Assert
      await expect(target.remove('ADMIN')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getPermissions ───
  describe('getPermissions', () => {
    it('should return menu codes for role', async () => {
      // Arrange
      const perms = [
        { roleCode: 'R1', menuCode: 'MENU1', canAccess: true },
        { roleCode: 'R1', menuCode: 'MENU2', canAccess: true },
      ] as RoleMenuPermission[];
      mockPermRepo.find.mockResolvedValue(perms);

      // Act
      const result = await target.getPermissions('R1');

      // Assert
      expect(result).toEqual(['MENU1', 'MENU2']);
    });
  });

  // ─── updatePermissions ───
  describe('updatePermissions', () => {
    it('should replace permissions for non-ADMIN role', async () => {
      // Arrange
      const role = { code: 'ROLE1', permissions: [] } as any;
      mockRoleRepo.findOne.mockResolvedValue(role);
      mockPermRepo.delete.mockResolvedValue({ affected: 2 } as any);
      mockPermRepo.create.mockReturnValue({} as any);
      mockPermRepo.save.mockResolvedValue([] as any);

      // Act
      const result = await target.updatePermissions('ROLE1', { menuCodes: ['M1', 'M2'] } as any);

      // Assert
      expect(result.menuCodes).toEqual(['M1', 'M2']);
    });

    it('should throw BadRequestException for ADMIN role', async () => {
      // Arrange
      const role = { code: 'ADMIN', permissions: [] } as any;
      mockRoleRepo.findOne.mockResolvedValue(role);

      // Act & Assert
      await expect(target.updatePermissions('ADMIN', { menuCodes: ['M1'] } as any)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getAllowedMenusByRoleCode ───
  describe('getAllowedMenusByRoleCode', () => {
    it('should return empty array for ADMIN', async () => {
      // Act
      const result = await target.getAllowedMenusByRoleCode('ADMIN');

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array when role not found', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await target.getAllowedMenusByRoleCode('NONEXIST');

      // Assert
      expect(result).toEqual([]);
    });

    it('should return menu codes for valid role', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue({ code: 'ROLE1' } as Role);
      mockPermRepo.find.mockResolvedValue([
        { menuCode: 'MENU1', canAccess: true },
        { menuCode: 'MENU2', canAccess: true },
      ] as RoleMenuPermission[]);

      // Act
      const result = await target.getAllowedMenusByRoleCode('ROLE1');

      // Assert
      expect(result).toEqual(['MENU1', 'MENU2']);
    });
  });
});
