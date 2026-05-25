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
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource, getMetadataArgsStorage } from 'typeorm';
import { PdaRoleService, PDA_MENU_CODES } from './pda-role.service';
import { PdaRole } from '../../../entities/pda-role.entity';
import { PdaRoleMenu } from '../../../entities/pda-role-menu.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('PdaRoleService', () => {
  let target: PdaRoleService;
  let mockRoleRepo: DeepMocked<Repository<PdaRole>>;
  let mockMenuRepo: DeepMocked<Repository<PdaRoleMenu>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockTx: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockRoleRepo = createMock<Repository<PdaRole>>();
    mockMenuRepo = createMock<Repository<PdaRoleMenu>>();
    mockDataSource = createMock<DataSource>();
    mockTx = createMock<TransactionService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdaRoleService,
        { provide: getRepositoryToken(PdaRole), useValue: mockRoleRepo },
        { provide: getRepositoryToken(PdaRoleMenu), useValue: mockMenuRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<PdaRoleService>(PdaRoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes tenant columns in PDA role primary key metadata', () => {
    const primaryColumnNames = getMetadataArgsStorage()
      .columns
      .filter(column => column.target === PdaRole && column.options.primary)
      .map(column => column.propertyName);

    expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plant', 'code']));
  });

  it('includes tenant columns in PDA role menu primary key metadata', () => {
    const primaryColumnNames = getMetadataArgsStorage()
      .columns
      .filter(column => column.target === PdaRoleMenu && column.options.primary)
      .map(column => column.propertyName);

    expect(primaryColumnNames).toEqual(expect.arrayContaining(['company', 'plant', 'pdaRoleCode', 'menuCode']));
  });

  // ─── findAll ───
  describe('findAll', () => {
    it('should return roles with menus relation', async () => {
      // Arrange
      const roles = [{ code: 'ROLE1', menus: [] }] as any[];
      mockRoleRepo.find.mockResolvedValue(roles);

      // Act
      const result = await target.findAll('C1', 'P1');

      // Assert
      expect(result).toEqual(roles);
      expect(mockRoleRepo.find).toHaveBeenCalledWith({
        where: { company: 'C1', plant: 'P1' },
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
      const result = await target.findAllActive('C1', 'P1');

      // Assert
      expect(result).toEqual(roles);
      expect(mockRoleRepo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true, company: 'C1', plant: 'P1' },
      }));
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
      mockTx.run.mockImplementation(async (cb) => cb({ manager: mockManager } as any));
      mockRoleRepo.findOne.mockResolvedValue({ code: 'NEW', menus: [] } as any);

      // Act
      const result = await target.create(dto as any, 'C1', 'P1');

      // Assert
      expect(mockTx.run).toHaveBeenCalled();
      expect(mockRoleRepo.findOne).toHaveBeenCalledWith({ where: { code: 'NEW', company: 'C1', plant: 'P1' } });
      expect(mockManager.create).toHaveBeenCalledWith(PdaRole, expect.objectContaining({ company: 'C1', plant: 'P1' }));
      expect(mockManager.create).toHaveBeenCalledWith(PdaRoleMenu, expect.objectContaining({ company: 'C1', plant: 'P1' }));
    });

    it('should throw ConflictException when code exists', async () => {
      // Arrange
      const dto = { code: 'EXISTING' } as any;
      mockRoleRepo.findOne.mockResolvedValue({ code: 'EXISTING' } as any);

      // Act & Assert
      await expect(target.create(dto, 'C1', 'P1')).rejects.toThrow(ConflictException);
    });

    it('should reject create when tenant is missing instead of defaulting to HANES/P01', async () => {
      mockRoleRepo.findOne.mockResolvedValue(null);

      await expect(target.create({ code: 'NEW', name: 'New Role' } as any)).rejects.toThrow(BadRequestException);

      expect(mockTx.run).not.toHaveBeenCalled();
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
      mockTx.run.mockImplementation(async (cb) => cb({ manager: mockManager } as any));

      // Act
      await target.update('R1', { name: 'Updated', menuCodes: ['PDA_SHIPPING'] } as any, 'C1', 'P1');

      // Assert
      expect(mockTx.run).toHaveBeenCalled();
      expect(mockManager.update).toHaveBeenCalledWith(PdaRole, { code: 'R1', company: 'C1', plant: 'P1' }, expect.objectContaining({ name: 'Updated' }));
      expect(mockManager.delete).toHaveBeenCalledWith(PdaRoleMenu, { pdaRoleCode: 'R1', company: 'C1', plant: 'P1' });
      expect(mockManager.create).toHaveBeenCalledWith(PdaRoleMenu, expect.objectContaining({ pdaRoleCode: 'R1', company: 'C1', plant: 'P1' }));
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.update('NONE', {} as any, 'C1', 'P1')).rejects.toThrow(NotFoundException);
    });

    it('should reject menu replacement when tenant is missing instead of defaulting to HANES/P01', async () => {
      mockRoleRepo.findOne.mockResolvedValue({ code: 'R1' } as any);

      await expect(target.update('R1', { menuCodes: ['PDA_SHIPPING'] } as any)).rejects.toThrow(BadRequestException);

      expect(mockTx.run).not.toHaveBeenCalled();
    });
  });

  // ─── remove ───
  describe('remove', () => {
    it('should delete role and return result', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue({ code: 'R1' } as any);
      mockRoleRepo.delete.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.remove('R1', 'C1', 'P1');

      // Assert
      expect(result).toEqual({ code: 'R1', deleted: true });
      expect(mockRoleRepo.delete).toHaveBeenCalledWith({ code: 'R1', company: 'C1', plant: 'P1' });
    });

    it('should throw NotFoundException when role not found', async () => {
      // Arrange
      mockRoleRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.remove('NONE')).rejects.toThrow(NotFoundException);
    });
  });
});
