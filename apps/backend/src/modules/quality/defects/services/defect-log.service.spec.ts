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
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { DefectCodeMaster } from '../../../../entities/defect-code-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('DefectLogService', () => {
  let target: DefectLogService;
  let mockDefectLogRepo: DeepMocked<Repository<DefectLog>>;
  let mockRepairLogRepo: DeepMocked<Repository<RepairLog>>;
  let mockProdResultRepo: DeepMocked<Repository<ProdResult>>;
  let mockReworkOrderRepo: DeepMocked<Repository<ReworkOrder>>;
  let mockFgLabelRepo: DeepMocked<Repository<FgLabel>>;
  let mockDefectCodeRepo: DeepMocked<Repository<DefectCodeMaster>>;

  /** 테스트용 불량로그 팩토리 */
  const createDefectLog = (overrides: Partial<DefectLog> = {}): DefectLog =>
    ({
      id: 1,
      occurAt: new Date('2026-03-18'),
      seq: 1,
      prodResultNo: 'PR260318-00001',
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
      resultNo: 'PR260318-00001',
      defectQty: 5,
      ...overrides,
    }) as ProdResult;

  const mockDefectQb = (options: { many?: any[]; count?: number; raw?: any[] } = {}) => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      getMany: jest.fn().mockResolvedValue(options.many ?? []),
      getCount: jest.fn().mockResolvedValue(options.count ?? 0),
      getRawMany: jest.fn().mockResolvedValue(options.raw ?? []),
    };
    qb.clone.mockReturnValue(qb);
    mockDefectLogRepo.createQueryBuilder.mockReturnValue(qb as any);
    return qb;
  };

  beforeEach(async () => {
    mockDefectLogRepo = createMock<Repository<DefectLog>>();
    mockRepairLogRepo = createMock<Repository<RepairLog>>();
    mockProdResultRepo = createMock<Repository<ProdResult>>();
    mockReworkOrderRepo = createMock<Repository<ReworkOrder>>();
    mockFgLabelRepo = createMock<Repository<FgLabel>>();
    mockDefectCodeRepo = createMock<Repository<DefectCodeMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefectLogService,
        { provide: getRepositoryToken(DefectLog), useValue: mockDefectLogRepo },
        { provide: getRepositoryToken(RepairLog), useValue: mockRepairLogRepo },
        { provide: getRepositoryToken(ProdResult), useValue: mockProdResultRepo },
        { provide: getRepositoryToken(ReworkOrder), useValue: mockReworkOrderRepo },
        { provide: getRepositoryToken(FgLabel), useValue: mockFgLabelRepo },
        { provide: getRepositoryToken(DefectCodeMaster), useValue: mockDefectCodeRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<DefectLogService>(DefectLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockReworkOrderRepo.findOne.mockResolvedValue(null);
    mockDefectCodeRepo.findOne.mockResolvedValue({
      defectCode: 'DEF001',
      defectName: '마스터 외관불량',
      useYn: 'Y',
    } as DefectCodeMaster);
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated defect logs enriched with workOrderNo/operator/id', async () => {
      // Arrange
      const defects = [createDefectLog()];
      mockDefectQb({ many: defects, count: 1 });
      mockProdResultRepo.find.mockResolvedValue([
        { resultNo: 'PR260318-00001', orderNo: 'WO-1', workerId: 'W003', equipCode: 'EQ-1' } as any,
      ]);

      // Act
      const result = await target.findAll({ page: 1, limit: 20 } as any);

      // Assert
      expect(result.total).toBe(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          // 화면용 복합 식별자(occurAtISO|seq)와 생산실적 보강 필드
          id: `${defects[0].occurAt.toISOString()}|1`,
          workOrderNo: 'WO-1',
          operator: 'W003',
          equipmentNo: 'EQ-1',
          defectCode: 'DEF001',
          qty: 2,
          status: 'WAIT',
        }),
      );
    });

    it('should apply search filter', async () => {
      // Arrange
      const qb = mockDefectQb({ many: [], count: 0 });

      // Act
      await target.findAll({ search: '외관' } as any);

      // Assert
      expect(qb.andWhere).toHaveBeenCalledWith('defect.defectName LIKE :search', { search: '%외관%' });
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
      expect(result.seq).toBe(1);
      expect(result.defectCode).toBe('DEF001');
    });

    it('should throw NotFoundException when not found', async () => {
      // Arrange
      mockDefectLogRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.findById('999')).rejects.toThrow(NotFoundException);
    });

    it('scopes defect lookup by tenant', async () => {
      const defect = createDefectLog();
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      await target.findById('1', 'HANES', 'P01');

      expect(mockDefectLogRepo.findOne).toHaveBeenCalledWith({
        where: { seq: 1, company: 'HANES', plant: 'P01' },
      });
    });

    it('resolves composite identifier (occurAtISO|seq) via full PK', async () => {
      const defect = createDefectLog({ occurAt: new Date('2026-06-10T05:00:00.000Z'), seq: 2 });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      await target.findById('2026-06-10T05:00:00.000Z|2', 'HANES', 'P01');

      expect(mockDefectLogRepo.findOne).toHaveBeenCalledWith({
        where: { occurAt: new Date('2026-06-10T05:00:00.000Z'), seq: 2, company: 'HANES', plant: 'P01' },
      });
    });
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────
  describe('create', () => {
    it('validates defectCode from DEFECT_CODE_MASTERS and derives defectName from the master', async () => {
      const prodResult = createProdResult({ defectQty: 3, company: 'HANES', plant: 'P01' } as any);
      mockProdResultRepo.findOne.mockResolvedValue(prodResult);
      mockDefectCodeRepo.findOne.mockResolvedValue({
        defectCode: 'DEF002',
        defectName: '마스터 치수불량',
        useYn: 'Y',
      } as DefectCodeMaster);
      mockDefectLogRepo.create.mockReturnValue(createDefectLog({ defectCode: 'DEF002', defectName: '마스터 치수불량' }));
      mockDefectLogRepo.save.mockResolvedValue(createDefectLog({ defectCode: 'DEF002', defectName: '마스터 치수불량' }));
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.create({
        prodResultNo: 'PR260318-00001',
        defectCode: 'def002',
        defectName: '프론트 임의명',
        qty: 2,
      } as any, 'HANES', 'P01');

      expect(mockDefectCodeRepo.findOne).toHaveBeenCalledWith({
        where: { defectCode: 'DEF002', company: 'HANES', plant: 'P01', useYn: 'Y' },
      });
      expect(mockDefectLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          defectCode: 'DEF002',
          defectName: '마스터 치수불량',
        }),
      );
    });

    it('rejects defect log creation when defectCode is not registered in DEFECT_CODE_MASTERS', async () => {
      mockDefectCodeRepo.findOne.mockResolvedValue(null);

      await expect(
        target.create({ prodResultNo: 'PR260318-00001', defectCode: 'NOPE' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(mockDefectLogRepo.save).not.toHaveBeenCalled();
    });

    it('should create defect log and update prodResult defectQty', async () => {
      // Arrange
      const prodResult = createProdResult({ defectQty: 3, company: 'HANES', plant: 'P01' } as any);
      const dto = {
        prodResultNo: 'PR260318-00001',
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
        { resultNo: 'PR260318-00001', company: 'HANES', plant: 'P01' },
        { defectQty: 5 }, // 3 + 2
      );
    });

    it('resolves prodResultNo from workOrderNo (latest prod-result) when prodResultNo is omitted', async () => {
      const latest = createProdResult({ resultNo: 'PR-LATEST', defectQty: 1, company: 'HANES', plant: 'P01' } as any);
      // 1st findOne: workOrderNo→최신 생산실적, 2nd findOne: 존재 확인
      mockProdResultRepo.findOne
        .mockResolvedValueOnce(latest)
        .mockResolvedValueOnce(latest);
      mockDefectLogRepo.create.mockReturnValue(createDefectLog({ prodResultNo: 'PR-LATEST' }));
      mockDefectLogRepo.save.mockResolvedValue(createDefectLog({ prodResultNo: 'PR-LATEST' }));
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.create({ workOrderNo: 'WO-1', defectCode: 'DEF001', qty: 2 } as any, 'HANES', 'P01');

      expect(mockProdResultRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { orderNo: 'WO-1', company: 'HANES', plant: 'P01' },
        order: { createdAt: 'DESC' },
      });
      expect(mockDefectLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ prodResultNo: 'PR-LATEST' }),
      );
    });

    it('resolves prodResultNo from prdUid (scanned product barcode)', async () => {
      const byProduct = createProdResult({ resultNo: 'PR-BYUID', defectQty: 0, company: 'HANES', plant: 'P01' } as any);
      mockProdResultRepo.findOne
        .mockResolvedValueOnce(byProduct) // prdUid → 생산실적
        .mockResolvedValueOnce(byProduct); // 존재 확인
      mockDefectLogRepo.create.mockReturnValue(createDefectLog({ prodResultNo: 'PR-BYUID' }));
      mockDefectLogRepo.save.mockResolvedValue(createDefectLog({ prodResultNo: 'PR-BYUID' }));
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.create({ prdUid: 'FG-0001', defectCode: 'DEF001', qty: 1 } as any, 'HANES', 'P01');

      expect(mockProdResultRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { prdUid: 'FG-0001', company: 'HANES', plant: 'P01' },
        order: { createdAt: 'DESC' },
      });
      expect(mockDefectLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ prodResultNo: 'PR-BYUID' }),
      );
    });

    it('resolves prodResultNo via FG label fallback (barcode → orderNo → latest prod-result)', async () => {
      const latest = createProdResult({ resultNo: 'PR-FG', defectQty: 0, company: 'HANES', plant: 'P01' } as any);
      mockProdResultRepo.findOne
        .mockResolvedValueOnce(null) // prdUid 직접 매칭 실패
        .mockResolvedValueOnce(latest) // FG라벨 orderNo → 최신 생산실적
        .mockResolvedValueOnce(latest); // 존재 확인
      mockFgLabelRepo.findOne.mockResolvedValue({ fgBarcode: 'FG26060900006', orderNo: 'W2026-002' } as any);
      mockDefectLogRepo.create.mockReturnValue(createDefectLog({ prodResultNo: 'PR-FG' }));
      mockDefectLogRepo.save.mockResolvedValue(createDefectLog({ prodResultNo: 'PR-FG' }));
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.create({ prdUid: 'FG26060900006', defectCode: 'DEF001' } as any, 'HANES', 'P01');

      expect(mockFgLabelRepo.findOne).toHaveBeenCalledWith({
        where: { fgBarcode: 'FG26060900006', company: 'HANES', plant: 'P01' },
      });
      expect(mockDefectLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ prodResultNo: 'PR-FG' }),
      );
    });

    it('throws NotFound when scanned product barcode matches neither prod-result nor FG label', async () => {
      mockProdResultRepo.findOne.mockResolvedValue(null);
      mockFgLabelRepo.findOne.mockResolvedValue(null);
      await expect(
        target.create({ prdUid: 'FG-NONE', defectCode: 'DEF001' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequest when neither prodResultNo nor workOrderNo is provided', async () => {
      await expect(
        target.create({ defectCode: 'DEF001' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound when workOrderNo has no prod-result', async () => {
      mockProdResultRepo.findOne.mockResolvedValue(null);

      await expect(
        target.create({ workOrderNo: 'WO-NONE', defectCode: 'DEF001' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects create when prodResult belongs to a different tenant', async () => {
      const prodResult = createProdResult({ company: 'OTHER', plant: 'P01' } as any);
      mockProdResultRepo.findOne.mockResolvedValue(prodResult);

      await expect(
        target.create({ prodResultNo: 'PR260318-00001', defectCode: 'DEF001' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(mockDefectLogRepo.save).not.toHaveBeenCalled();
    });

    it('should default qty to 1 when not provided', async () => {
      // Arrange
      const prodResult = createProdResult({ defectQty: 0 });
      mockProdResultRepo.findOne.mockResolvedValue(prodResult);
      mockDefectLogRepo.create.mockReturnValue(createDefectLog());
      mockDefectLogRepo.save.mockResolvedValue(createDefectLog());
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.create({ prodResultNo: 'PR260318-00001', defectCode: 'DEF001' } as any);

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
        target.create({ prodResultNo: '999', defectCode: 'DEF001' } as any),
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
      const result = await target.delete('1', 'HANES', 'P01');

      // Assert
      expect(result).toEqual({ id: '1', deleted: true });
      expect(mockDefectLogRepo.delete).toHaveBeenCalledTimes(1);
      expect(mockProdResultRepo.update).toHaveBeenCalledWith(
        { resultNo: 'PR260318-00001', company: 'HANES', plant: 'P01' },
        expect.objectContaining({ defectQty: expect.any(Function) }),
      );
      expect(mockDefectLogRepo.delete).toHaveBeenCalledWith({
        occurAt: defect.occurAt,
        seq: defect.seq,
        company: 'HANES',
        plant: 'P01',
      });
    });

    it('rejects delete when defect belongs to a different tenant', async () => {
      const defect = createDefectLog({ company: 'OTHER' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      await expect(target.delete('1', 'HANES', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockDefectLogRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should apply the qty delta back to the linked prodResult', async () => {
      const defect = createDefectLog({ qty: 2 });
      const updated = createDefectLog({ qty: 5 });

      mockDefectLogRepo.findOne
        .mockResolvedValueOnce(defect)
        .mockResolvedValueOnce(updated);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockProdResultRepo.update.mockResolvedValue({ affected: 1 } as any);

      await target.update('1', { qty: 5 } as any, 'HANES', 'P01');

      expect(mockProdResultRepo.update).toHaveBeenCalledWith(
        { resultNo: 'PR260318-00001', company: 'HANES', plant: 'P01' },
        { defectQty: expect.any(Function) },
      );
    });

    it('rejects update when defect belongs to a different tenant', async () => {
      const defect = createDefectLog({ plant: 'OTHER' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      await expect(target.update('1', { qty: 5 } as any, 'HANES', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockDefectLogRepo.update).not.toHaveBeenCalled();
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
      const result = await target.changeStatus('1', { status: 'REPAIR' } as any, 'HANES', 'P01');

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: defect.occurAt, seq: defect.seq, company: 'HANES', plant: 'P01' },
        { status: 'REPAIR' },
      );
      expect(mockReworkOrderRepo.findOne).toHaveBeenCalledWith({
        where: {
          defectLogId: `${defect.occurAt.toISOString()}|${defect.seq}`,
          company: 'HANES',
          plant: 'P01',
        },
      });
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

    it('rejects status change when defect belongs to a different tenant', async () => {
      const defect = createDefectLog({ company: 'OTHER' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      await expect(
        target.changeStatus('1', { status: 'REPAIR' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(mockDefectLogRepo.update).not.toHaveBeenCalled();
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
      const result = await target.createRepairLog(dto as any, 'HANES', 'P01');

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
      await target.createRepairLog(dto as any, 'HANES', 'P01');

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: defect.occurAt, seq: defect.seq, company: 'HANES', plant: 'P01' },
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
      await target.createRepairLog(dto as any, 'HANES', 'P01');

      // Assert
      expect(mockDefectLogRepo.update).toHaveBeenCalledWith(
        { occurAt: defect.occurAt, seq: defect.seq, company: 'HANES', plant: 'P01' },
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
      await target.createRepairLog(dto as any, 'HANES', 'P01');

      // Assert — FAIL이면 상태 변경하지 않음
      expect(mockDefectLogRepo.update).not.toHaveBeenCalled();
    });

    it('rejects repair log creation when defect belongs to a different tenant', async () => {
      const defect = createDefectLog({ plant: 'OTHER' });
      mockDefectLogRepo.findOne.mockResolvedValue(defect);

      await expect(
        target.createRepairLog({ defectLogId: '1', workerId: 'worker' } as any, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepairLogRepo.save).not.toHaveBeenCalled();
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
      const result = await target.getPendingDefects('HANES', 'P01');

      // Assert
      expect(result).toHaveLength(2);
      expect(mockDefectLogRepo.find).toHaveBeenCalledWith({
        where: { status: expect.any(Object), company: 'HANES', plant: 'P01' }, // In(['WAIT','REPAIR','REWORK'])
        order: { occurAt: 'ASC' },
      });
    });
  });

  describe('stats', () => {
    const mockStatsQb = (rows: any[]) => {
      return mockDefectQb({ raw: rows });
    };

    it('should scope defect type stats by tenant', async () => {
      const qb = mockStatsQb([{ defectCode: 'DEF001', defectName: 'Scratch', count: '1', totalQty: '2' }]);

      await target.getStatsByDefectType(undefined, undefined, 'HANES', 'P01');

      expect(qb.andWhere).toHaveBeenCalledWith('defect.company = :company', { company: 'HANES' });
      expect(qb.andWhere).toHaveBeenCalledWith('defect.plant = :plant', { plant: 'P01' });
    });

    it('should scope defect status stats by tenant', async () => {
      const qb = mockStatsQb([{ status: 'WAIT', count: '1', totalQty: '2' }]);

      await target.getStatsByStatus(undefined, undefined, 'HANES', 'P01');

      expect(qb.andWhere).toHaveBeenCalledWith('defect.company = :company', { company: 'HANES' });
      expect(qb.andWhere).toHaveBeenCalledWith('defect.plant = :plant', { plant: 'P01' });
    });

    it('should scope daily defect trend by tenant', async () => {
      const qb = mockDefectQb({ many: [] });

      await target.getDailyDefectTrend(7, 'HANES', 'P01');

      expect(qb.andWhere).toHaveBeenCalledWith('defect.company = :company', { company: 'HANES' });
      expect(qb.andWhere).toHaveBeenCalledWith('defect.plant = :plant', { plant: 'P01' });
      expect(qb.orderBy).toHaveBeenCalledWith('defect.occurAt', 'ASC');
    });
  });
});
