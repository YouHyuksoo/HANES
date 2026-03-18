/**
 * @file src/modules/inventory/services/inventory.service.spec.ts
 * @description InventoryService 단위 테스트 - 수불 트랜잭션 핵심 로직 검증
 *
 * 초보자 가이드:
 * - QueryRunner를 모킹하여 트랜잭션 로직 테스트
 * - `target`: 테스트 대상(SUT), `mock*`: 모킹된 의존성
 * - 실행: `pnpm test -- -t "InventoryService"`
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { InventoryService } from './inventory.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('InventoryService', () => {
  let target: InventoryService;
  let mockStockTransRepo: DeepMocked<Repository<StockTransaction>>;
  let mockStockRepo: DeepMocked<Repository<MatStock>>;
  let mockLotRepo: DeepMocked<Repository<MatLot>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockPartMasterRepo: DeepMocked<Repository<PartMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    mockStockTransRepo = createMock<Repository<StockTransaction>>();
    mockStockRepo = createMock<Repository<MatStock>>();
    mockLotRepo = createMock<Repository<MatLot>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockPartMasterRepo = createMock<Repository<PartMaster>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();

    // QueryRunner 체인 모킹
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTransRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockStockRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockLotRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(PartMaster), useValue: mockPartMasterRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // generateMatUid
  // ─────────────────────────────────────────────
  describe('generateMatUid', () => {
    it('should generate UID with seq 0001 when no existing lot', async () => {
      // Arrange
      mockLotRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await target.generateMatUid('RM');

      // Assert
      expect(result).toMatch(/^RM\d{8}0001$/);
    });

    it('should increment seq from last lot', async () => {
      // Arrange
      const today = new Date();
      const prefix = `RM${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      mockLotRepo.findOne.mockResolvedValue({ matUid: `${prefix}0042` } as MatLot);

      // Act
      const result = await target.generateMatUid('RM');

      // Assert
      expect(result).toBe(`${prefix}0043`);
    });
  });

  // ─────────────────────────────────────────────
  // createLot
  // ─────────────────────────────────────────────
  describe('createLot', () => {
    it('should create and save lot', async () => {
      // Arrange
      const dto = {
        matUid: 'RM202603180001',
        itemCode: 'PART-001',
        initQty: 100,
        recvDate: '2026-03-18',
        vendor: 'VENDOR-A',
      };
      const savedLot = { ...dto, createdAt: new Date() } as any;
      mockLotRepo.create.mockReturnValue(savedLot);
      mockLotRepo.save.mockResolvedValue(savedLot);

      // Act
      const result = await target.createLot(dto as any);

      // Assert
      expect(result).toEqual(savedLot);
      expect(mockLotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          matUid: 'RM202603180001',
          itemCode: 'PART-001',
          initQty: 100,
        }),
      );
      expect(mockLotRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────
  // receiveStock
  // ─────────────────────────────────────────────
  describe('receiveStock', () => {
    const receiveDto = {
      warehouseCode: 'WH-RM',
      itemCode: 'PART-001',
      matUid: 'RM202603180001',
      qty: 100,
      transType: 'MAT_IN',
      unitPrice: 1500,
      workerId: 'admin@harness.com',
      remark: '입고 테스트',
    };

    beforeEach(() => {
      // generateTransNo 내부 호출 모킹
      mockStockTransRepo.findOne.mockResolvedValue(null);
    });

    it('should create transaction and new stock when no existing stock', async () => {
      // Arrange
      const savedTrans = { transNo: 'TRX202603180001', ...receiveDto } as any;
      mockStockTransRepo.create.mockReturnValue(savedTrans);
      mockQueryRunner.manager.save.mockResolvedValue(savedTrans);
      mockQueryRunner.manager.findOne.mockResolvedValue(null); // 기존 재고 없음

      // Act
      const result = await target.receiveStock(receiveDto as any);

      // Assert — transNo는 모킹된 create 반환값에서 옴
      expect(result.transNo).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2); // transaction + stock
    });

    it('should update existing stock qty on receive', async () => {
      // Arrange
      const existingStock = {
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 50,
        reservedQty: 10,
        availableQty: 40,
      };
      const savedTrans = { transNo: 'TRX202603180001' } as any;
      mockStockTransRepo.create.mockReturnValue(savedTrans);
      mockQueryRunner.manager.save.mockResolvedValue(savedTrans);
      mockQueryRunner.manager.findOne.mockResolvedValue(existingStock); // 기존 재고 있음
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.receiveStock(receiveDto as any);

      // Assert
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-RM', itemCode: 'PART-001', matUid: 'RM202603180001' },
        { qty: 150, availableQty: 140 }, // 50+100=150, 150-10=140
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('should rollback on error', async () => {
      // Arrange
      mockStockTransRepo.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(target.receiveStock(receiveDto as any)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────
  // issueStock
  // ─────────────────────────────────────────────
  describe('issueStock', () => {
    const issueDto = {
      warehouseCode: 'WH-RM',
      itemCode: 'PART-001',
      matUid: 'RM202603180001',
      qty: 30,
      transType: 'MAT_OUT',
      workerId: 'admin@harness.com',
    };

    beforeEach(() => {
      mockStockTransRepo.findOne.mockResolvedValue(null);
    });

    it('should issue stock and decrease qty', async () => {
      // Arrange
      const existingStock = {
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 100,
        reservedQty: 0,
        availableQty: 100,
      };
      const savedTrans = { transNo: 'TRX202603180001', qty: -30 } as any;
      mockStockTransRepo.create.mockReturnValue(savedTrans);
      mockQueryRunner.manager.findOne.mockResolvedValue(existingStock);
      mockQueryRunner.manager.save.mockResolvedValue(savedTrans);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      const result = await target.issueStock(issueDto as any);

      // Assert
      expect(result.qty).toBe(-30);
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-RM', itemCode: 'PART-001', matUid: 'RM202603180001' },
        { qty: 70, availableQty: 70 }, // 100-30, 100-30
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      // Arrange
      const lowStock = {
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 10,
        reservedQty: 0,
        availableQty: 10,
      };
      mockQueryRunner.manager.findOne.mockResolvedValue(lowStock);

      // Act & Assert
      await expect(target.issueStock(issueDto as any)).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when no stock exists', async () => {
      // Arrange
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.issueStock(issueDto as any)).rejects.toThrow(BadRequestException);
    });

    it('should handle transfer with target warehouse', async () => {
      // Arrange
      const issueDtoWithTarget = { ...issueDto, toWarehouseCode: 'WH-WIP' };
      const sourceStock = {
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 100,
        reservedQty: 0,
        availableQty: 100,
      };
      const savedTrans = { transNo: 'TRX202603180001', qty: -30 } as any;
      mockStockTransRepo.create.mockReturnValue(savedTrans);

      // 첫 findOne: 출고창고 재고, 두번째: 입고창고 재고(없음)
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(sourceStock)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.save.mockResolvedValue(savedTrans);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await target.issueStock(issueDtoWithTarget as any);

      // Assert — save가 2번 호출됨 (트랜잭션 + 대상창고 신규 재고)
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────
  // cancelTransaction
  // ─────────────────────────────────────────────
  describe('cancelTransaction', () => {
    it('should cancel receive transaction and restore stock', async () => {
      // Arrange
      const originalTrans = {
        transNo: 'TRX202603180001',
        transType: 'MAT_IN',
        toWarehouseId: 'WH-RM',
        fromWarehouseId: null,
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 100,
        unitPrice: 1500,
        totalAmount: 150000,
        refType: null,
        refId: null,
        cancelRefId: null,
        status: 'DONE',
      };
      const cancelTrans = { transNo: 'TRX202603180002', transType: 'MAT_IN_CANCEL', qty: -100 } as any;

      mockStockTransRepo.findOne.mockResolvedValueOnce(originalTrans as any); // 원본 조회
      mockStockTransRepo.findOne.mockResolvedValue(null); // generateTransNo
      mockStockTransRepo.create.mockReturnValue(cancelTrans);

      const existingStock = {
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 100,
        reservedQty: 0,
        availableQty: 100,
      };
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      mockQueryRunner.manager.save.mockResolvedValue(cancelTrans);
      mockQueryRunner.manager.findOne.mockResolvedValue(existingStock);

      // Act
      const result = await target.cancelTransaction({
        transactionId: 'TRX202603180001',
        workerId: 'admin@harness.com',
      } as any);

      // Assert
      expect(result.transType).toBe('MAT_IN_CANCEL');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when original transaction not found', async () => {
      // Arrange
      mockStockTransRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        target.cancelTransaction({ transactionId: 'NOT_EXIST' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already canceled', async () => {
      // Arrange
      mockStockTransRepo.findOne.mockResolvedValue({
        transNo: 'TRX202603180001',
        status: 'CANCELED',
      } as any);

      // Act & Assert
      await expect(
        target.cancelTransaction({ transactionId: 'TRX202603180001' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // getStock
  // ─────────────────────────────────────────────
  describe('getStock', () => {
    it('should return flattened stock data with related info', async () => {
      // Arrange
      const stocks = [
        { warehouseCode: 'WH-RM', itemCode: 'PART-001', matUid: 'RM001', qty: 100, reservedQty: 10, availableQty: 90 },
      ] as MatStock[];
      mockStockRepo.find.mockResolvedValue(stocks);
      mockWarehouseRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-RM', warehouseName: '원자재창고', warehouseType: 'RM' } as Warehouse,
      ]);
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'PART-001', itemName: '부품A', itemType: 'RM', unit: 'EA' } as PartMaster,
      ]);
      mockLotRepo.find.mockResolvedValue([
        { matUid: 'RM001', status: 'ACTIVE' } as MatLot,
      ]);

      // Act
      const result = await target.getStock({} as any);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        warehouseId: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM001',
        qty: 100,
        reservedQty: 10,
        availableQty: 90,
        itemName: '부품A',
        itemType: 'RM',
        unit: 'EA',
        warehouseCode: 'WH-RM',
        warehouseName: '원자재창고',
        warehouseType: 'RM',
        lotStatus: 'ACTIVE',
      });
    });

    it('should exclude zero qty stocks by default', async () => {
      // Arrange
      const stocks = [
        { warehouseCode: 'WH-RM', itemCode: 'PART-001', matUid: null, qty: 0, reservedQty: 0, availableQty: 0 },
      ] as MatStock[];
      mockStockRepo.find.mockResolvedValue(stocks);

      // Act
      const result = await target.getStock({} as any);

      // Assert
      expect(result).toEqual([]);
    });

    it('should include zero qty stocks when includeZero is true', async () => {
      // Arrange
      const stocks = [
        { warehouseCode: 'WH-RM', itemCode: 'PART-001', matUid: null, qty: 0, reservedQty: 0, availableQty: 0 },
      ] as MatStock[];
      mockStockRepo.find.mockResolvedValue(stocks);
      mockWarehouseRepo.find.mockResolvedValue([]);
      mockPartMasterRepo.find.mockResolvedValue([]);
      mockLotRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.getStock({ includeZero: true } as any);

      // Assert
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no stocks found', async () => {
      // Arrange
      mockStockRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.getStock({} as any);

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────
  // getLotById
  // ─────────────────────────────────────────────
  describe('getLotById', () => {
    it('should return lot with related data', async () => {
      // Arrange
      const lot = { matUid: 'RM001', itemCode: 'PART-001' } as MatLot;
      mockLotRepo.findOne.mockResolvedValue(lot);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', itemName: '부품A' } as PartMaster);
      mockStockRepo.find.mockResolvedValue([]);
      mockStockTransRepo.find.mockResolvedValue([]);
      mockWarehouseRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.getLotById('RM001');

      // Assert
      expect(result.matUid).toBe('RM001');
      expect(result.part?.itemName).toBe('부품A');
      expect(result.stocks).toEqual([]);
      expect(result.transactions).toEqual([]);
    });

    it('should throw NotFoundException when lot not found', async () => {
      // Arrange
      mockLotRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.getLotById('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // getTransactionById
  // ─────────────────────────────────────────────
  describe('getTransactionById', () => {
    it('should return transaction with related data', async () => {
      // Arrange
      const trans = {
        transNo: 'TRX001',
        transType: 'MAT_IN',
        fromWarehouseId: null,
        toWarehouseId: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM001',
        cancelRefId: null,
      } as any;
      mockStockTransRepo.findOne
        .mockResolvedValueOnce(trans) // 메인 조회
        .mockResolvedValue(null);     // canceledByTrans

      mockWarehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-RM', warehouseName: '원자재창고' } as Warehouse);
      mockPartMasterRepo.findOne.mockResolvedValue({ itemCode: 'PART-001', itemName: '부품A' } as PartMaster);
      mockLotRepo.findOne.mockResolvedValue({ matUid: 'RM001' } as MatLot);

      // Act
      const result = await target.getTransactionById('TRX001');

      // Assert
      expect(result.transNo).toBe('TRX001');
      expect(result.toWarehouse?.warehouseName).toBe('원자재창고');
      expect(result.part?.itemName).toBe('부품A');
    });

    it('should throw NotFoundException when transaction not found', async () => {
      // Arrange
      mockStockTransRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(target.getTransactionById('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // getStockSummary
  // ─────────────────────────────────────────────
  describe('getStockSummary', () => {
    it('should return grouped summary by itemCode', async () => {
      // Arrange
      const stocks = [
        { warehouseCode: 'WH-RM', itemCode: 'PART-001', qty: 100 },
        { warehouseCode: 'WH-WIP', itemCode: 'PART-001', qty: 50 },
      ] as MatStock[];
      mockStockRepo.find.mockResolvedValue(stocks);
      mockWarehouseRepo.find.mockResolvedValue([
        { warehouseCode: 'WH-RM', warehouseName: '원자재', warehouseType: 'RM' } as Warehouse,
        { warehouseCode: 'WH-WIP', warehouseName: '재공', warehouseType: 'WIP' } as Warehouse,
      ]);
      mockPartMasterRepo.find.mockResolvedValue([
        { itemCode: 'PART-001', itemName: '부품A', itemType: 'RM' } as PartMaster,
      ]);

      // Act
      const result = await target.getStockSummary({});

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].itemCode).toBe('PART-001');
      expect(result[0].totalQty).toBe(150);
      expect(result[0].warehouses).toHaveLength(2);
    });

    it('should return empty array when no stocks', async () => {
      // Arrange
      mockStockRepo.find.mockResolvedValue([]);

      // Act
      const result = await target.getStockSummary({});

      // Assert
      expect(result).toEqual([]);
    });
  });
});
