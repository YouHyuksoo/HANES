/**
 * @file src/modules/system/services/pda-role.service.spec.ts
 * @description PdaRoleService 단위 테스트
 *
 * 초보자 가이드:
 * - target: 테스트 대상(SUT), mock*: 모킹된 의존성
 * - 실행: `pnpm test -- -t "PdaRoleService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { PdaRoleService, PDA_MENU_CODES } from './pda-role.service';
import { PdaRole } from '../../../entities/pda-role.entity';
import { PdaRoleMenu } from '../../../entities/pda-role-menu.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('PdaRoleService', () => {
  let target: PdaRoleService;
  let mockRoleRepo: DeepMocked<Repository<PdaRole>>;
  let mockMenuRepo: DeepMocked<Repository<PdaRoleMenu>>;
  let mockDataSource: DeepMocked<DataSource>;

  beforeEach(async () => {
    mockRoleRepo = createMock<Repository<PdaRole>>();
    mockMenuRepo = createMock<Repository<PdaRoleMenu>>();
    mockDataSource = createMock<DataSource>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdaRoleService,
        { provide: getRepositoryToken(PdaRole), useValue: mockRoleRepo },
        { provide: getRepositoryToken(PdaRoleMenu), useValue: mockMenuRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<PdaRoleService>(PdaRoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return roles with menus relation', async () => {
      // Arrange
      const roles = [{ code: 'ROLE1', menus: [] }] as any[];
      mockRoleRepo.find.mockResolvedValue(roles);

      // Act
      const result = await target.findAll();

      // Assert
      expect(result).toEqual(roles);
      expect(mockRoleRepo.find).toHaveBeenCalledWith({
        relations: ['menus'],
        order: { createdAt: 'ASC' },
      });
    });
  });

  // ─── findAllActive ───
  describe('findAllActive', () => {
    it('should return active roles with code and name only', async () => {
      // Arrange
      const roles = [{ code: 'R1', name: 'Role 1' }] as any[];
      mockRoleRepo.find.mockResolvedValue(roles);

      // Act
      const result = await target.findAllActive();

      // Assert
      expect(result).toEqual(roles);
    });
  });

  // ─── getMenuCodes ───
  describe('getMenuCodes', () => {
    it('should return PDA_MENU_CODES constant', () => {
      const result = target.getMenuCodes();
      expect(result).toEqual(PDA_MENU_CODES);
    });
  });

  // ─── create ───
  describe('create', () => {
    it('should create role with menus in transaction', async () => {
      // Arrange
      const dto = { code: 'NEW', name: 'New Role', menuCodes: ['PDA_SHIPPING'] };
      mockRoleRepo.findOne.mockResolvedValueOnce(null); // no existing
      const mockManager = createMock<any>();
      mockManager.create.mockReturnValue({} as any);
      mockManager.save.mockResolvedValue({} as any);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));
      mockRoleRepo.findOne.mockResolvedValue({ code: 'NEW', menus: [] } as any);

      // Act
      const result = await target.create(dto as any);

      // Assert
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException when code exists', async () => {
      // Arrange
      const dto = { code: 'EXISTING' } as any;
      mockRoleRepo.findOne.mockResolvedValue({ code: 'EXISTING' } as any);

      // Act & Assert
      await expect(target.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ───
  describe('update', () => {
    it('should update role and replace menus', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue({ code: 'R1' } as any);
      const mockManager = createMock<any>();
      mockManager.update.mockResolvedValue({} as any);
      mockManager.delete.mockResolvedValue({} as any);
      mockManager.create.mockReturnValue({} as any);
      mockManager.save.mockResolvedValue({} as any);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      // Act
      await target.update('R1', { name: 'Updated', menuCodes: ['PDA_SHIPPING'] } as any);

      // Assert
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.update('NONE', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ───
  describe('remove', () => {
    it('should delete role and return result', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue({ code: 'R1' } as any);
      mockRoleRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.remove('R1');

      // Assert
      expect(result).toEqual({ code: 'R1', deleted: true });
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.remove('NONE')).rejects.toThrow(NotFoundException);
    });
  });
});
