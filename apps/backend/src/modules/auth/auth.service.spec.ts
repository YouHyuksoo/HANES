/**
 * @file src/modules/auth/auth.service.spec.ts
 * @description AuthService 단위 테스트
 *
 * 초보자 가이드:
 * - `pnpm test -- -t "AuthService"` 로 이 파일만 실행
 * - AAA 패턴: Arrange(준비) → Act(실행) → Assert(검증)
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../../entities/user.entity';
import { PdaRoleMenu } from '../../entities/pda-role-menu.entity';
import { RoleService } from '../role/role.service';
import { ActivityLogService } from '../system/services/activity-log.service';
import { MockLoggerService } from '@test/mock-logger.service';

describe('AuthService', () => {
  let target: AuthService;
  let mockUserRepo: DeepMocked<Repository<User>>;
  let mockPdaRoleMenuRepo: DeepMocked<Repository<PdaRoleMenu>>;
  let mockRoleService: DeepMocked<RoleService>;
  let mockActivityLogService: DeepMocked<ActivityLogService>;

  /** 테스트용 활성 사용자 팩토리 */
  const createActiveUser = (overrides: Partial<User> = {}): User =>
    ({
      email: 'test@harness.com',
      password: 'password123',
      name: '테스트사용자',
      empNo: 'EMP001',
      dept: '생산부',
      role: 'OPERATOR',
      status: 'ACTIVE',
      company: 'HANES',
      plant: 'P01',
      pdaRoleCode: null,
      lastLoginAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      ...overrides,
    }) as User;

  beforeEach(async () => {
    mockUserRepo = createMock<Repository<User>>();
    mockPdaRoleMenuRepo = createMock<Repository<PdaRoleMenu>>();
    mockRoleService = createMock<RoleService>();
    mockActivityLogService = createMock<ActivityLogService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(PdaRoleMenu), useValue: mockPdaRoleMenuRepo },
        { provide: RoleService, useValue: mockRoleService },
        { provide: ActivityLogService, useValue: mockActivityLogService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // login
  // ─────────────────────────────────────────────
  describe('login', () => {
    it('should return token and user when credentials are valid', async () => {
      // Arrange
      const user = createActiveUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue(['menu1']);
      mockActivityLogService.logActivity.mockResolvedValue(undefined);
      mockPdaRoleMenuRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.login({
        email: 'test@harness.com',
        password: 'password123',
      });

      // Assert
      expect(result.token).toBe('test@harness.com');
      expect(result.user.email).toBe('test@harness.com');
      expect(result.user.name).toBe('테스트사용자');
      expect(result.user.role).toBe('OPERATOR');
      expect(result.user.company).toBe('HANES');
      expect(result.allowedMenus).toEqual(['menu1']);
      expect(result.pdaAllowedMenus).toEqual([]);
      expect(mockRoleService.getAllowedMenusByRoleCode).toHaveBeenCalledWith('OPERATOR', 'HANES', 'P01');
      expect(mockUserRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should use dto.company when provided', async () => {
      // Arrange
      const user = createActiveUser({ company: 'OLD' });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue([]);
      mockActivityLogService.logActivity.mockResolvedValue(undefined);

      // Act
      const result = await target.login({
        email: 'test@harness.com',
        password: 'password123',
        company: 'NEW_CO',
      });

      // Assert
      expect(result.user.company).toBe('NEW_CO');
    });

    it('should find and update the user within the selected tenant', async () => {
      // Arrange
      const user = createActiveUser({ company: 'C1', plant: 'P1' });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue([]);
      mockActivityLogService.logActivity.mockResolvedValue(undefined);
      mockPdaRoleMenuRepo.find.mockResolvedValue([]);

      // Act
      await target.login({
        email: 'test@harness.com',
        password: 'password123',
        company: 'C1',
        plant: 'P1',
      });

      // Assert
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@harness.com', company: 'C1', plant: 'P1' },
      });
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        { email: 'test@harness.com', company: 'C1', plant: 'P1' },
        { lastLoginAt: expect.any(Date) },
      );
    });

    it('should use dto.plant when provided', async () => {
      // Arrange
      const user = createActiveUser({ plant: 'OLD_P' });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue([]);
      mockActivityLogService.logActivity.mockResolvedValue(undefined);

      // Act
      const result = await target.login({
        email: 'test@harness.com',
        password: 'password123',
        company: 'HANES',
        plant: 'NEW_P',
      });

      // Assert
      expect(result.user.plant).toBe('NEW_P');
      expect(mockRoleService.getAllowedMenusByRoleCode).toHaveBeenCalledWith('OPERATOR', 'HANES', 'NEW_P');
    });

    it('should return pdaAllowedMenus when user has pdaRoleCode', async () => {
      // Arrange
      const user = createActiveUser({ pdaRoleCode: 'PDA_WORKER' });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue([]);
      mockActivityLogService.logActivity.mockResolvedValue(undefined);
      mockPdaRoleMenuRepo.find.mockResolvedValue([
        { menuCode: 'PDA_MAT_RECEIVING' } as PdaRoleMenu,
        { menuCode: 'PDA_SHIPPING' } as PdaRoleMenu,
      ]);

      // Act
      const result = await target.login({
        email: 'test@harness.com',
        password: 'password123',
      });

      // Assert
      expect(result.pdaAllowedMenus).toEqual(['PDA_MAT_RECEIVING', 'PDA_SHIPPING']);
      expect(mockPdaRoleMenuRepo.find).toHaveBeenCalledWith({
        where: { pdaRoleCode: 'PDA_WORKER', isActive: true, company: 'HANES', plant: 'P01' },
        select: ['menuCode'],
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      mockUserRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.login({ email: 'nobody@harness.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is inactive', async () => {
      // Arrange
      const user = createActiveUser({ status: 'INACTIVE' });
      mockUserRepo.findOne.mockResolvedValue(user);

      // Act & Assert
      await expect(
        target.login({ email: 'test@harness.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      // Arrange
      const user = createActiveUser();
      mockUserRepo.findOne.mockResolvedValue(user);

      // Act & Assert
      await expect(
        target.login({ email: 'test@harness.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not fail login when activity log fails', async () => {
      // Arrange
      const user = createActiveUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue([]);
      mockActivityLogService.logActivity.mockRejectedValue(new Error('log fail'));

      // Act
      const result = await target.login({
        email: 'test@harness.com',
        password: 'password123',
      });

      // Assert — 로그 실패해도 로그인 성공
      expect(result.token).toBe('test@harness.com');
    });
  });

  // ─────────────────────────────────────────────
  // register
  // ─────────────────────────────────────────────
  describe('register', () => {
    it('should create user and return token', async () => {
      // Arrange
      const dto = {
        email: 'new@harness.com',
        password: 'newpass',
        name: '신규사용자',
        empNo: 'EMP002',
        dept: '품질부',
      };
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue({
        ...dto,
        role: 'OPERATOR',
        status: 'ACTIVE',
      } as User);
      mockUserRepo.save.mockResolvedValue({
        ...dto,
        role: 'OPERATOR',
        status: 'ACTIVE',
      } as User);

      // Act
      const result = await target.register(dto);

      // Assert
      expect(result.token).toBe('new@harness.com');
      expect(result.user.email).toBe('new@harness.com');
      expect(result.user.name).toBe('신규사용자');
      expect(result.user.role).toBe('OPERATOR');
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        email: 'new@harness.com',
        password: 'newpass',
        name: '신규사용자',
        empNo: 'EMP002',
        dept: '품질부',
        role: 'OPERATOR',
        company: null,
        plant: null,
      });
      expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when email already exists', async () => {
      // Arrange
      mockUserRepo.findOne.mockResolvedValue(createActiveUser());

      // Act & Assert
      await expect(
        target.register({ email: 'test@harness.com', password: 'pass' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should persist selected tenant when registering a user', async () => {
      const dto = {
        email: 'new@harness.com',
        password: 'newpass',
        name: '신규사용자',
        company: 'HANES',
        plant: 'P01',
      };
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockImplementation((payload) => ({ ...payload, status: 'ACTIVE' }) as User);
      mockUserRepo.save.mockImplementation(async (payload) => payload as User);

      const result = await target.register(dto);

      expect(mockUserRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        email: 'new@harness.com',
        company: 'HANES',
        plant: 'P01',
      }));
      expect(result.user.company).toBe('HANES');
      expect(result.user.plant).toBe('P01');
    });
  });

  // ─────────────────────────────────────────────
  // me
  // ─────────────────────────────────────────────
  describe('me', () => {
    it('should return user with allowedMenus', async () => {
      // Arrange
      const user = createActiveUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue(['dashboard', 'material']);

      // Act
      const result = await target.me('test@harness.com');

      // Assert
      expect(result.email).toBe('test@harness.com');
      expect(result.allowedMenus).toEqual(['dashboard', 'material']);
      expect(result.pdaAllowedMenus).toEqual([]);
      expect(mockRoleService.getAllowedMenusByRoleCode).toHaveBeenCalledWith('OPERATOR', 'HANES', 'P01');
    });

    it('should lookup current user within requested tenant when provided', async () => {
      // Arrange
      const user = createActiveUser({ company: 'C1', plant: 'P1' });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue([]);

      // Act
      await target.me('test@harness.com', 'C1', 'P1');

      // Assert
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@harness.com', company: 'C1', plant: 'P1' },
        select: [
          'email',
          'name',
          'empNo',
          'dept',
          'role',
          'status',
          'company',
          'plant',
          'lastLoginAt',
          'pdaRoleCode',
        ],
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      mockUserRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.me('nobody@harness.com')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      // Arrange
      const user = createActiveUser({ status: 'INACTIVE' });
      mockUserRepo.findOne.mockResolvedValue(user);

      // Act & Assert
      await expect(target.me('test@harness.com')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should include pdaAllowedMenus when user has pdaRoleCode', async () => {
      // Arrange
      const user = createActiveUser({ pdaRoleCode: 'PDA_LEADER' });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockRoleService.getAllowedMenusByRoleCode.mockResolvedValue([]);
      mockPdaRoleMenuRepo.find.mockResolvedValue([
        { menuCode: 'PDA_EQUIP_INSPECT' } as PdaRoleMenu,
      ]);

      // Act
      const result = await target.me('test@harness.com');

      // Assert
      expect(result.pdaAllowedMenus).toEqual(['PDA_EQUIP_INSPECT']);
      expect(mockPdaRoleMenuRepo.find).toHaveBeenCalledWith({
        where: { pdaRoleCode: 'PDA_LEADER', isActive: true, company: 'HANES', plant: 'P01' },
        select: ['menuCode'],
      });
    });
  });
});
