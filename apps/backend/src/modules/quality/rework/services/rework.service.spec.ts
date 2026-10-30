/**
 * @file rework.service.spec.ts
 * @description ReworkService 단위 테스트
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReworkService } from './rework.service';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { ReworkInspect } from '../../../../entities/rework-inspect.entity';
import { ReworkProcess } from '../../../../entities/rework-process.entity';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { Warehouse } from '../../../../entities/warehouse.entity';
import { ProductInventoryService } from '../../../inventory/services/product-inventory.service';
import { WarehouseService } from '../../../inventory/services/warehouse.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { NumberingService } from '../../../../shared/numbering.service';
import { TransactionService } from '../../../../shared/transaction.service';

const orderForInspect = () => ({
  reworkNo: 'RW-200', status: 'INSPECT_PENDING', itemCode: 'IT-1', resultQty: 1,
  defectLogId: '2026-04-08T00:00:00.000Z|2', company: 'CO', plant: 'P01',
});

describe('ReworkService', () => {
  let target: ReworkService;
  let mockReworkRepo: DeepMocked<Repository<ReworkOrder>>;
  let mockInspectRepo: DeepMocked<Repository<ReworkInspect>>;
  let mockProcessRepo: DeepMocked<Repository<ReworkProcess>>;
  let mockDefectLogRepo: DeepMocked<Repository<DefectLog>>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockTx: DeepMocked<TransactionService>;
  let mockProductInventoryService: DeepMocked<ProductInventoryService>;
  let mockWarehouseService: DeepMocked<WarehouseService>;

  beforeEach(async () => {
    mockReworkRepo = createMock<Repository<ReworkOrder>>();
    mockInspectRepo = createMock<Repository<ReworkInspect>>();
    mockProcessRepo = createMock<Repository<ReworkProcess>>();
    mockDefectLogRepo = createMock<Repository<DefectLog>>();
    mockNumbering = createMock<NumberingService>();
    mockTx = createMock<TransactionService>();
    mockProductInventoryService = createMock<ProductInventoryService>();
    mockWarehouseService = createMock<WarehouseService>();
    mockWarehouseService.getDefaultWarehouse.mockResolvedValue({ warehouseCode: 'WH-DEFECT' } as Warehouse);
    mockTx.run.mockImplementation(async (callback: any) => callback({
      query: jest.fn().mockResolvedValue([{ NEXT_SEQ: 1 }]),
      manager: {
        create: jest.fn((_: any, value: any) => value),
        save: jest.fn(async (_: any, value: any) => value),
        update: jest.fn(),
        findOne: jest.fn().mockResolvedValue(orderForInspect()),
      },
    } as any));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReworkService,
        { provide: getRepositoryToken(ReworkOrder), useValue: mockReworkRepo },
        { provide: getRepositoryToken(ReworkInspect), useValue: mockInspectRepo },
        { provide: getRepositoryToken(ReworkProcess), useValue: mockProcessRepo },
        { provide: getRepositoryToken(DefectLog), useValue: mockDefectLogRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: ProductInventoryService, useValue: mockProductInventoryService },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
        { provide: WarehouseService, useValue: mockWarehouseService },
      ],
    }).setLogger(new MockLoggerService()).compile();
    target = module.get<ReworkService>(ReworkService);
  });
  afterEach(() => jest.clearAllMocks());

  describe('findById', () => {
    it('should return rework order with processes', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      const r = await target.findById('RW-001');
      expect(r.reworkNo).toBe('RW-001');
      expect(mockReworkRepo.findOne).toHaveBeenCalledWith({
        where: { reworkNo: 'RW-001' },
      });
    });
    it('should throw NotFoundException', async () => {
      mockReworkRepo.findOne.mockResolvedValue(null);
      await expect(target.findById('X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should not join a non-existent defectLog relation', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
      };
      mockReworkRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await target.findAll({ limit: 5000 } as any, 'CO', 'P01');

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 5000 });
      expect(mockReworkRepo.createQueryBuilder).toHaveBeenCalledWith('r');
      expect(qb.leftJoinAndSelect).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw when not REGISTERED or REJECTED', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'IN_PROGRESS', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      await expect(target.update('RW-001', {} as any, 'user')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update — 연결 불량·null 처리', () => {
    const editable = (overrides: Record<string, unknown> = {}) =>
      ({
        reworkNo: 'RW-010',
        status: 'REGISTERED',
        reworkQty: 3,
        reworkMethod: 'RESOLDER',
        itemCode: 'IT-1',
        company: 'CO',
        plant: 'P01',
        ...overrides,
      }) as any;

    beforeEach(() => {
      mockProcessRepo.find.mockResolvedValue([]);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
    });

    it('연결된 불량을 다른 값으로 바꾸면 400', async () => {
      mockReworkRepo.findOne.mockResolvedValue(editable({ defectLogId: '2026-04-08T00:00:00.000Z|1' }));
      await expect(target.update('RW-010', { defectLogId: '2026-04-08T00:00:00.000Z|9' } as any, 'user', 'CO', 'P01'))
        .rejects.toThrow(/연결된 불량은 바꿀 수 없습니다/);
      expect(mockReworkRepo.update).not.toHaveBeenCalled();
    });

    it('같은 연결 불량을 다시 보내면 통과한다', async () => {
      mockReworkRepo.findOne.mockResolvedValue(editable({ defectLogId: '2026-04-08T00:00:00.000Z|1' }));
      await expect(target.update('RW-010', { defectLogId: '2026-04-08T00:00:00.000Z|1', remark: 'ok' } as any, 'user', 'CO', 'P01'))
        .resolves.toBeDefined();
      const updateMock = mockReworkRepo.update.mock.calls[0][1] as Record<string, unknown>;
      expect(updateMock.remark).toBe('ok');
      expect(updateMock.defectLogId).toBeUndefined();
    });

    it('필수 컬럼의 null 은 무시하고 나머지는 그 값으로 바꾼다', async () => {
      mockReworkRepo.findOne.mockResolvedValue(editable());
      await target.update('RW-010', { itemCode: null, reworkQty: null, reworkMethod: null, remark: null } as any, 'user', 'CO', 'P01');
      const updateMock = mockReworkRepo.update.mock.calls[0][1] as Record<string, unknown>;
      expect(updateMock.itemCode).toBeUndefined();
      expect(updateMock.reworkQty).toBeUndefined();
      expect(updateMock.reworkMethod).toBeUndefined();
      expect(updateMock.remark).toBeNull();
      expect(updateMock.updatedBy).toBe('user');
    });

    it('수량 수정 시 대기 공정의 계획 수량을 함께 맞춘다', async () => {
      mockReworkRepo.findOne.mockResolvedValue(editable());
      mockProcessRepo.update.mockResolvedValue({ affected: 1 } as any);
      await target.update('RW-010', { reworkQty: 4 } as any, 'user', 'CO', 'P01');
      expect(mockProcessRepo.update).toHaveBeenCalledWith(
        { reworkOrderId: 'RW-010', status: 'WAITING', company: 'CO', plant: 'P01' },
        { planQty: 4, updatedBy: 'user' },
      );
    });

    it('연결 불량 수량보다 크게 수량을 바꾸면 400', async () => {
      mockReworkRepo.findOne.mockResolvedValue(editable({ defectLogId: '2026-04-08T00:00:00.000Z|1' }));
      mockDefectLogRepo.findOne.mockResolvedValue({ occurAt: new Date(), seq: 1, status: 'REWORK', qty: 2 } as any);
      await expect(target.update('RW-010', { reworkQty: 4 } as any, 'user', 'CO', 'P01'))
        .rejects.toThrow(BadRequestException);
      expect(mockProcessRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('complete — 완료 검증', () => {
    beforeEach(() => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-020',
        status: 'IN_PROGRESS',
        reworkQty: 10,
        company: 'CO',
        plant: 'P01',
      } as any);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockInspectRepo.find.mockResolvedValue([]);
    });

    it('미완료 공정이 남으면 400', async () => {
      mockProcessRepo.find.mockResolvedValue([
        { status: 'COMPLETED', resultQty: 10 } as any,
        { status: 'WAITING', resultQty: 0 } as any,
      ]);
      await expect(target.complete('RW-020', { resultQty: 10 } as any, 'user', 'CO', 'P01')).rejects.toThrow(BadRequestException);
      expect(mockReworkRepo.update).not.toHaveBeenCalled();
    });

    it('실적 수량이 0 이면 400', async () => {
      mockProcessRepo.find.mockResolvedValue([]);
      await expect(target.complete('RW-020', { resultQty: 0 } as any, 'user', 'CO', 'P01')).rejects.toThrow(
        /재작업 실적 수량은 1 이상/,
      );
    });

    it('실적 수량이 재작업 수량을 초과하면 400', async () => {
      mockProcessRepo.find.mockResolvedValue([]);
      await expect(target.complete('RW-020', { resultQty: 11 } as any, 'user', 'CO', 'P01')).rejects.toThrow(
        /많을 수 없습니다/,
      );
    });

    it('모든 공정이 끝나면 지시를 재검사대기로 바꾼다', async () => {
      mockProcessRepo.find.mockResolvedValue([
        { status: 'COMPLETED', resultQty: 6 } as any,
        { status: 'SKIPPED', resultQty: 0 } as any,
      ]);
      await target.complete('RW-020', { resultQty: 99 } as any, 'user', 'CO', 'P01');
      expect(mockReworkRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ reworkNo: 'RW-020', company: 'CO', plant: 'P01' }),
        expect.objectContaining({ status: 'INSPECT_PENDING', resultQty: 6 }),
      );
    });
  });

  describe('complete — 순차 공정 실적', () => {
    it('공정이 여러 개여도 합산하지 않고 마지막 순번 완료 공정의 수량을 지시 실적으로 쓴다', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-021', status: 'IN_PROGRESS', reworkQty: 10, company: 'CO', plant: 'P01' } as any);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([
        { seq: 1, status: 'COMPLETED', resultQty: 10 } as any,
        { seq: 2, status: 'COMPLETED', resultQty: 8 } as any,
      ]);
      await target.complete('RW-021', { resultQty: 99 } as any, 'user', 'CO', 'P01');
      expect(mockReworkRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ reworkNo: 'RW-021' }),
        expect.objectContaining({ status: 'INSPECT_PENDING', resultQty: 8 }),
      );
    });
  });

  describe('delete', () => {
    it('should throw when not REGISTERED', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'APPROVED', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      await expect(target.delete('RW-001')).rejects.toThrow(BadRequestException);
    });

    it('should restore linked defect status before deleting registered rework', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-001',
        status: 'REGISTERED',
        defectLogId: '2026-04-08T00:00:00.000Z|1',
        id: 1,
      } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockReworkRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('RW-001');

      expect(mockDefectLogRepo.update).toHaveBeenCalledTimes(1);
      const [where, patch] = mockDefectLogRepo.update.mock.calls[0];
      expect(where.seq).toBe(1);
      expect(where.company).toBeUndefined();
      expect(where.plant).toBeUndefined();
      expect(where.status).toBe('REWORK');
      expect(patch).toEqual({ status: 'WAIT' });
    });

    it('should restore linked defect status within the rework tenant', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-001',
        status: 'REGISTERED',
        defectLogId: '2026-04-08T00:00:00.000Z|1',
        id: 1,
        company: 'CO',
        plant: 'P01',
      } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockInspectRepo.find.mockResolvedValue([]);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockReworkRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await target.delete('RW-001', 'CO', 'P01');

      expect(mockDefectLogRepo.update).toHaveBeenCalledTimes(1);
      const [where, patch] = mockDefectLogRepo.update.mock.calls[0];
      expect(where.seq).toBe(1);
      expect(where.company).toBe('CO');
      expect(where.plant).toBe('P01');
      expect(where.status).toBe('REWORK');
      expect(patch).toEqual({ status: 'WAIT' });
    });

    it('should block delete when rework process has already progressed', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-002',
        status: 'REGISTERED',
        id: 2,
      } as any);
      mockProcessRepo.find.mockResolvedValue([
        { reworkOrderId: 'RW-002', status: 'IN_PROGRESS' } as any,
      ]);

      await expect(target.delete('RW-002')).rejects.toThrow(BadRequestException);
      expect(mockReworkRepo.delete).not.toHaveBeenCalled();
    });

    it('should block delete when inspection history already exists', async () => {
      mockReworkRepo.findOne.mockResolvedValue({
        reworkNo: 'RW-003',
        status: 'REGISTERED',
        id: 3,
      } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockInspectRepo.find.mockResolvedValue([{ reworkOrderId: 'RW-003' } as any]);

      await expect(target.delete('RW-003')).rejects.toThrow(BadRequestException);
      expect(mockReworkRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('create — 불량이력 상태 연동', () => {
    it('defectLogId가 있으면 불량이력을 공통코드 DEFECT_LOG_STATUS.REWORK 로 바꾸고, 재작업 공정은 REWORK_PROCESS_STATUS.WAITING 으로 만든다', async () => {
      mockNumbering.next.mockResolvedValue('RW-100');
      mockReworkRepo.create.mockImplementation((v: any) => v);
      mockReworkRepo.save.mockResolvedValue({} as any);
      // 중복 연결 확인(찾을 수 없음) → 저장 후 지시 조회
      mockReworkRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ reworkNo: 'RW-100', status: 'REGISTERED' } as any);
      mockProcessRepo.create.mockImplementation((v: any) => v);
      mockProcessRepo.save.mockResolvedValue([] as any);
      mockDefectLogRepo.findOne.mockResolvedValue({
        occurAt: new Date('2026-04-08T00:00:00.000Z'),
        seq: 1,
        status: 'WAIT',
        qty: 5,
      } as any);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
      const mockItemMasterRepo = (target as any).itemMasterRepo as DeepMocked<Repository<ItemMaster>>;
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'IT-1' } as any);

      await target.create(
        {
          defectLogId: '2026-04-08T00:00:00.000Z|1',
          itemCode: 'IT-1',
          reworkQty: 5,
          reworkMethod: 'RESOLDER',
          processItems: [{ processCode: 'P10', processName: '재납땜', seq: 1 }],
        } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockItemMasterRepo.findOne).toHaveBeenCalledTimes(1);
      const [where, patch] = mockDefectLogRepo.update.mock.calls[0];
      expect(where.seq).toBe(1);
      expect(where.company).toBe('CO');
      expect(where.plant).toBe('P01');
      expect(patch).toEqual({ status: 'REWORK' });
      const processes = mockProcessRepo.save.mock.calls[0][0] as any[];
      expect(processes).toHaveLength(1);
      expect(processes[0].status).toBe('WAITING');
      expect(mockReworkRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'REGISTERED' }));
    });

    it('WAIT 이외 상태의 불량은 재작업을 지시할 수 없다', async () => {
      mockDefectLogRepo.findOne.mockResolvedValue({ occurAt: new Date(), seq: 1, status: 'REPAIR', qty: 5 } as any);
      const mockItemMasterRepo = (target as any).itemMasterRepo as DeepMocked<Repository<ItemMaster>>;
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'IT-1' } as any);

      await expect(target.create(
        { defectLogId: '2026-04-08T00:00:00.000Z|1', itemCode: 'IT-1', reworkQty: 2, reworkMethod: 'RESOLDER' } as any,
        'CO',
        'P01',
        'user',
      )).rejects.toThrow(BadRequestException);
      expect(mockReworkRepo.save).not.toHaveBeenCalled();
    });

    it('품목이 없으면 NotFoundException', async () => {
      const mockItemMasterRepo = (target as any).itemMasterRepo as DeepMocked<Repository<ItemMaster>>;
      mockItemMasterRepo.findOne.mockResolvedValue(null);

      await expect(target.create({ itemCode: 'NOPE', reworkQty: 1, reworkMethod: 'X' } as any, 'CO', 'P01', 'user'))
        .rejects.toThrow(NotFoundException);
    });

    it('불량 수량보다 많은 재작업 수량은 400', async () => {
      mockDefectLogRepo.findOne.mockResolvedValue({ occurAt: new Date(), seq: 1, status: 'WAIT', qty: 2 } as any);
      mockReworkRepo.findOne.mockResolvedValue(null as any);
      const mockItemMasterRepo = (target as any).itemMasterRepo as DeepMocked<Repository<ItemMaster>>;
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'IT-1' } as any);

      await expect(target.create(
        { defectLogId: '2026-04-08T00:00:00.000Z|1', itemCode: 'IT-1', reworkQty: 3, reworkMethod: 'X' } as any,
        'CO',
        'P01',
        'user',
      )).rejects.toThrow(BadRequestException);
    });

    it('이미 재작업이 연결된 불량은 400', async () => {
      mockDefectLogRepo.findOne.mockResolvedValue({ occurAt: new Date(), seq: 1, status: 'WAIT', qty: 5 } as any);
      // 중복 연결 확인에서 기존 연결 발견
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-099' } as any);
      const mockItemMasterRepo = (target as any).itemMasterRepo as DeepMocked<Repository<ItemMaster>>;
      mockItemMasterRepo.findOne.mockResolvedValue({ itemCode: 'IT-1' } as any);

      await expect(target.create(
        { defectLogId: '2026-04-08T00:00:00.000Z|1', itemCode: 'IT-1', reworkQty: 2, reworkMethod: 'X' } as any,
        'CO',
        'P01',
        'user',
      )).rejects.toThrow(BadRequestException);
    });
  });

  describe('createInspect — 불량이력 상태 연동', () => {
    const order = {
      reworkNo: 'RW-200',
      status: 'INSPECT_PENDING',
      itemCode: 'IT-1',
      resultQty: 1,
      defectLogId: '2026-04-08T00:00:00.000Z|2',
      company: 'CO',
      plant: 'P01',
    };

    beforeEach(() => {
      mockReworkRepo.findOne.mockResolvedValue(order as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockInspectRepo.query.mockResolvedValue([{ NEXT_SEQ: 1 }]);
      mockInspectRepo.create.mockImplementation((v: any) => v);
      mockInspectRepo.save.mockImplementation(async (v: any) => v);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockDefectLogRepo.update.mockResolvedValue({ affected: 1 } as any);
    });

    it.each([
      ['PASS', 'DONE', 1, 0],
      ['SCRAP', 'SCRAP', 0, 1],
      ['FAIL', 'REWORK', 0, 1],
    ])('검사결과 %s → 불량이력 상태 %s (DEFECT_LOG_STATUS 정본만 기록)', async (inspectResult, expectedDefectStatus, passQty, failQty) => {
      await target.createInspect(
        { reworkNo: 'RW-200', inspectResult, passQty, failQty, inspectorCode: 'QC1', inspectMethod: 'VISUAL' } as any,
        'CO',
        'P01',
        'user',
      );

      expect(mockTx.run).toHaveBeenCalledTimes(1);
    });

    it('SCRAP 판정은 전체 수량이 불합격(폐기)이어야 한다', async () => {
      await expect(target.createInspect(
        { reworkNo: 'RW-200', inspectResult: 'SCRAP', passQty: 1, failQty: 0, inspectorCode: 'QC1' } as any,
        'CO',
        'P01',
        'user',
      )).rejects.toThrow(/SCRAP 판정은 전체 수량이 불합격/);
      expect(mockTx.run).not.toHaveBeenCalled();
    });
  });

  describe('qcApprove', () => {
    it('should approve QC pending', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'QC_PENDING', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      mockReworkRepo.update.mockResolvedValue({ affected: 1 } as any);
      await target.qcApprove('RW-001', { action: 'APPROVE' } as any, 'user');
      expect(mockReworkRepo.update).toHaveBeenCalled();
    });
    it('should throw when not QC_PENDING', async () => {
      mockReworkRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001', status: 'REGISTERED', id: 1 } as any);
      mockProcessRepo.find.mockResolvedValue([]);
      await expect(target.qcApprove('RW-001', { action: 'APPROVE' } as any, 'user')).rejects.toThrow(BadRequestException);
    });
  });
});
