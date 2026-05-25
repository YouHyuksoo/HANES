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
import { Repository, getMetadataArgsStorage } from 'typeorm';
import { RoleService } from './role.service';
import { Role } from '../../entities/role.entity';
import { RoleMenuPermission } from '../../entities/role-menu-permission.entity';
import { MockLoggerService } from '@test/mock-logger.service';

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

  describe('entity tenant keys', () => {
    it('should include company and plant in Role primary key', () => {
      const primaryColumnNames = getMetadataArgsStorage()
        .columns
        .filter(column => column.target === Role && column.options.primary)
        .map(column => column.propertyName);

      expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plant', 'code']));
    });

    it('should include company and plant in RoleMenuPermission primary key', () => {
      const primaryColumnNames = getMetadataArgsStorage()
        .columns
        .filter(column => column.target === RoleMenuPermission && column.options.primary)
        .map(column => column.propertyName);

      expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plant', 'roleCode', 'menuCode']));
    });
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
      const result = await target.findOne('ADMIN', 'C1', 'P1');

      // Assert
      expect(result).toEqual(role);
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findOne('NONE', 'C1', 'P1')).rejects.toThrow(NotFoundException);
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
      const result = await target.create(dto, 'C1', 'P1');

      // Assert
      expect(result).toEqual(dto);
    });

    it('should throw ConflictException when code exists', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue({ code: 'EXISTING' } as any);

      // Act & Assert
      await expect(target.create({ code: 'EXISTING' } as any, 'C1', 'P1')).rejects.toThrow(ConflictException);
    });

    it('should reject create when tenant is missing instead of defaulting to HANES/P01', async () => {
      mockRoleRepo.findOne.mockResolvedValue(null);

      await expect(target.create({ code: 'NEW', name: 'New Role' } as any)).rejects.toThrow(BadRequestException);

      expect(mockRoleRepo.create).not.toHaveBeenCalled();
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
      const result = await target.update('ROLE1', { name: 'Updated' } as any, 'C1', 'P1');

      // Assert
      expect(result).toEqual(role);
      expect(mockRoleRepo.update).toHaveBeenCalledWith(
        { code: 'ROLE1', company: 'C1', plant: 'P1' },
        expect.objectContaining({ name: 'Updated' }),
      );
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
      const result = await target.remove('ROLE1', 'C1', 'P1');

      // Assert
      expect(result).toEqual({ message: '역할이 삭제되었습니다.' });
      expect(mockRoleRepo.delete).toHaveBeenCalledWith({ code: 'ROLE1', company: 'C1', plant: 'P1' });
    });

    it('should throw BadRequestException for system role', async () => {
      // Arrange
      const role = { code: 'ADMIN', isSystem: true, permissions: [] } as any;
      mockRoleRepo.findOne.mockResolvedValue(role);

      // Act & Assert
      await expect(target.remove('ADMIN', 'C1', 'P1')).rejects.toThrow(BadRequestException);
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
      const result = await target.getPermissions('R1', 'C1', 'P1');

      // Assert
      expect(result).toEqual(['MENU1', 'MENU2']);
      expect(mockPermRepo.find).toHaveBeenCalledWith({
        where: { roleCode: 'R1', canAccess: true, company: 'C1', plant: 'P1' },
      });
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
      const result = await target.updatePermissions('ROLE1', { menuCodes: ['M1', 'M2'] } as any, 'C1', 'P1');

      // Assert
      expect(result.menuCodes).toEqual(['M1', 'M2']);
      expect(mockPermRepo.delete).toHaveBeenCalledWith({ roleCode: 'ROLE1', company: 'C1', plant: 'P1' });
      expect(mockPermRepo.create).toHaveBeenCalledWith(expect.objectContaining({ roleCode: 'ROLE1', company: 'C1', plant: 'P1' }));
    });

    it('should throw BadRequestException for ADMIN role', async () => {
      // Arrange
      const role = { code: 'ADMIN', permissions: [] } as any;
      mockRoleRepo.findOne.mockResolvedValue(role);

      // Act & Assert
      await expect(target.updatePermissions('ADMIN', { menuCodes: ['M1'] } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    });

    it('should reject permission updates when tenant is missing instead of defaulting to HANES/P01', async () => {
      await expect(target.updatePermissions('ROLE1', { menuCodes: ['M1'] } as any)).rejects.toThrow(BadRequestException);

      expect(mockPermRepo.create).not.toHaveBeenCalled();
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
      const result = await target.getAllowedMenusByRoleCode('NONEXIST', 'C1', 'P1');

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
      const result = await target.getAllowedMenusByRoleCode('ROLE1', 'C1', 'P1');

      // Assert
      expect(result).toEqual(['MENU1', 'MENU2']);
      expect(mockRoleRepo.findOne).toHaveBeenCalledWith({
        where: { code: 'ROLE1', company: 'C1', plant: 'P1' },
      });
      expect(mockPermRepo.find).toHaveBeenCalledWith({
        where: { roleCode: 'ROLE1', canAccess: true, company: 'C1', plant: 'P1' },
      });
    });
  });
});
