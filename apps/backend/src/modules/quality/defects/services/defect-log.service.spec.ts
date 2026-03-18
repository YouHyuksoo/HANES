/**
 * @file src/modules/quality/defects/services/defect-log.service.spec.ts
 * @description DefectLogService 단위 테스트 - 불량로그 CRUD + 상태관리 + 수리이력
 *
 * 초보자 가이드:
 * - 불량 상태 흐름: WAIT → REPAIR/REWORK → DONE/SCRAP
 * - 실행: `pnpm test -- -t "DefectLogService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DefectLogService } from './defect-log.service';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { RepairLog } from '../../../../entities/repair-log.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { MockLoggerService } from '../../../../common/test/mock-logger.service';

describe('DefectLogService', () => {
  let target: DefectLogService;
  let mockDefectLogRepo: DeepMocked<Repository<DefectLog>>;
  let mockRepairLogRepo: DeepMocked<Repository<RepairLog>>;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;

  /** 테스트용 불량로그 팩토리 */
  const createDefectLog = (overrides: Partial<DefectLog> = {}): DefectLog =>
    ({
      id: 1,
      occurAt: new Date('2026-03-18'),
      seq: 1,
      prodResultId: 100,
      defectCode: 'DEF001',
      defectName: '외관불량',
      qty: 2,
      status: 'WAIT',
      cause: '스크래치',
      imageUrl: null,
      company: 'HANES',
      plant: 'P01',
      createdAt: new Date('2026-03-18'),
      updatedAt: new Date('2026-03-18'),
      ...overrides,
    }) as DefectLog;

  /** 테스트용 생산실적 팩토리 */
  const createProdResult = (overrides: Partial<ProdResult> = {}): ProdResult =>
    ({
      id: 100,
      defectQty: 5,
      ...overrides,
    }) as ProdResult;

  beforeEach(async () => {
    mockDefectLogRepo = createMock<Repository<DefectLog>>();
    mockRepairLogRepo = createMock<Repository<RepairLog>>();
    mockProdResultRepo = createMock<Repository<ProdResult>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefectLogService,
        { provide: getRepositoryToken(DefectLog), useValue: mockDefectLogRepo },
        { provide: getRepositoryToken(RepairLog), useValue: mockRepairLogRepo },
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<DefectLogService>(DefectLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated defect logs', async () => {
      // Arrange
      const defects = [createDefectLog()];
      mockDefectLogRepo.find.mockResolvedValue(defects);
      mockDefectLogRepo.count.mockResolvedValue(1);

      // Act
      const result = await target.findAll({ page: 1, limit: 20 } as any);

      // Assert
      expect(result.data).toEqual(defects);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply search filter', async () => {
      // Arrange
      mockDefectLogRepo.find.mockResolvedValue([]);
      mockDefectLogRepo.count.mockResolvedValue(0);

      // Act
      await target.findAll({ search: '외관' } as any);

      // Assert
      expect(mockDefectLogRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            defectName: expect.any(Object), // ILike('%외관%')
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────
  describe('findById', () => {
    it('should return defect log when found', async () => {
      // Arrange
      const defect = createDefectLog();
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      // Act
      const result = await target.findById('1');

      // Assert
      expect(result.id).toBe(1);
      expect(result.defectCode).toBe('DEF001');
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockDefectLogRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('999')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    it('should create defect log and update prodResult defectQty', async () => {
      // Arrange
      const prodResult = createProdResult({ defectQty: 3 });
      const dto = {
        prodResultId: '100',
        defectCode: 'DEF002',
        defectName: '치수불량',
        qty: 2,
      };
      const savedDefect = createDefectLog({ defectCode: 'DEF002', defectName: '치수불량' });

      mockProdResultRepo.findOne.mockResolvedValue(prodResult);
      mockDefectLogRepo.create.mockReturnValue(savedDefect);
      mockDefectLogRepo.save.mockResolvedValue(savedDefect);
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.create(dto as any, 'HANES', 'P01');

      // Assert
      expect(result.defectCode).toBe('DEF002');
      expect(mockProdResultRepo.update).toHaveBeenCalledWith(
        { id: 100 },
        { defectQty: 5 }, // 3 + 2
      );
    });

    it('should default qty to 1 when not provided', async () => {
      // Arrange
      const prodResult = createProdResult({ defectQty: 0 });
      mockProdResultRepo.findOne.mockResolvedValue(prodResult);
      mockDefectLogRepo.create.mockReturnValue(createDefectLog());
      mockDefectLogRepo.save.mockResolvedValue(createDefectLog());
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.create({ prodResultId: '100', defectCode: 'DEF001' } as any);

      // Assert
      expect(mockDefectLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ qty: 1 }),
      );
    });

    it('should throw NotFoundException when prodResult not found', async () => {
      // Arrange
      mockProdResultRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.create({ prodResultId: '999', defectCode: 'DEF001' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────
  describe('delete', () => {
    it('should delete defect and decrease prodResult defectQty', async () => {
      // Arrange
      const defect = createDefectLog({ qty: 3 });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockDefectLogRepo.delete.mockResolvedValue({ affected: 1 } as any);
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.delete('1');

      // Assert
      expect(result).toEqual({ id: '1', deleted: true });
      expect(mockDefectLogRepo.delete).toHaveBeenCalledTimes(1);
      expect(mockProdResultRepo.update).toHaveBeenCalledWith(
        { id: 100 },
        expect.objectContaining({ defectQty: expect.any(Function) }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // changeStatus (상태 전이 검증 — 핵심 비즈니스 로직)
  // ─────────────────────────────────────────────
  describe('changeStatus', () => {
    it('should allow WAIT → REPAIR', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'WAIT' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.changeStatus('1', { status: 'REPAIR' } as any);

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: defect.occurAt, seq: defect.seq },
        { status: 'REPAIR' },
      );
    });

    it('should allow WAIT → REWORK', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'WAIT' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.changeStatus('1', { status: 'REWORK' } as any);

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should allow WAIT → SCRAP', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'WAIT' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.changeStatus('1', { status: 'SCRAP' } as any);

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should allow REPAIR → DONE', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'REPAIR' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.changeStatus('1', { status: 'DONE' } as any);

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should reject DONE → any (완료 후 변경 불가)', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'DONE' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      // Act & Assert
      await expect(
        target.changeStatus('1', { status: 'WAIT' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject SCRAP → any (폐기 후 변경 불가)', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'SCRAP' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      // Act & Assert
      await expect(
        target.changeStatus('1', { status: 'REPAIR' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject WAIT → DONE (직접 완료 불가)', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'WAIT' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      // Act & Assert
      await expect(
        target.changeStatus('1', { status: 'DONE' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // createRepairLog
  // ─────────────────────────────────────────────
  describe('createRepairLog', () => {
    it('should create repair log', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'REPAIR' });
      const dto = {
        defectLogId: '1',
        workerId: 'worker@harness.com',
        repairAction: '재용접',
        result: 'FAIL',
      };
      const savedRepair = { id: 1, ...dto } as any;

      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockRepairLogRepo.create.mockReturnValue(savedRepair);
      mockRepairLogRepo.save.mockResolvedValue(savedRepair);

      // Act
      const result = await target.createRepairLog(dto as any);

      // Assert
      expect(result).toEqual(savedRepair);
      expect(mockRepairLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should auto-change status to DONE when result is PASS', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'REPAIR' });
      const dto = {
        defectLogId: '1',
        workerId: 'worker@harness.com',
        repairAction: '재용접',
        result: 'PASS',
      };
      const savedRepair = { id: 1, ...dto } as any;

      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockRepairLogRepo.create.mockReturnValue(savedRepair);
      mockRepairLogRepo.save.mockResolvedValue(savedRepair);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.createRepairLog(dto as any);

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: defect.occurAt, seq: defect.seq },
        { status: 'DONE' },
      );
    });

    it('should auto-change status to SCRAP when result is SCRAP', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'REPAIR' });
      const dto = {
        defectLogId: '1',
        workerId: 'worker@harness.com',
        repairAction: '폐기처리',
        result: 'SCRAP',
      };
      const savedRepair = { id: 1, ...dto } as any;

      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockRepairLogRepo.create.mockReturnValue(savedRepair);
      mockRepairLogRepo.save.mockResolvedValue(savedRepair);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.createRepairLog(dto as any);

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: defect.occurAt, seq: defect.seq },
        { status: 'SCRAP' },
      );
    });

    it('should not change status when result is FAIL', async () => {
      // Arrange
      const defect = createDefectLog({ status: 'REPAIR' });
      const dto = {
        defectLogId: '1',
        workerId: 'worker@harness.com',
        repairAction: '재시도',
        result: 'FAIL',
      };
      const savedRepair = { id: 1, ...dto } as any;

      mockDefectLogRepo.findOne.mockResolvedValue(defect);
      mockRepairLogRepo.create.mockReturnValue(savedRepair);
      mockRepairLogRepo.save.mockResolvedValue(savedRepair);

      // Act
      await target.createRepairLog(dto as any);

      // Assert — FAIL이면 상태 변경하지 않음
      expect(mockDefectLogRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // getPendingDefects
  // ─────────────────────────────────────────────
  describe('getPendingDefects', () => {
    it('should return defects with WAIT, REPAIR, REWORK status', async () => {
      // Arrange
      const pending = [
        createDefectLog({ status: 'WAIT' }),
        createDefectLog({ status: 'REPAIR', seq: 2 }),
      ];
      mockDefectLogRepo.find.mockResolvedValue(pending);

      // Act
      const result = await target.getPendingDefects();

      // Assert
      expect(result).toHaveLength(2);
      expect(mockDefectLogRepo.find).toHaveBeenCalledWith({
        where: { status: expect.any(Object) }, // In(['WAIT','REPAIR','REWORK'])
        order: { occurAt: 'ASC' },
      });
    });
  });
});
