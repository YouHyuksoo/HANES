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
import { Repository, DataSource, QueryRunner, Like, getMetadataArgsStorage } from 'typeorm';
import { InventoryService } from './inventory.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { InventoryQueryService } from './inventory-query.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('InventoryService', () => {
  let target: InventoryService;
  let mockStockTransRepo: DeepMocked<Repository<StockTransaction>>;
  let mockStockRepo: DeepMocked<Repository<MatStock>>;
  let mockLotRepo: DeepMocked<Repository<MatLot>>;
  let mockWarehouseRepo: DeepMocked<Repository<Warehouse>>;
  let mockItemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let mockDataSource: DeepMocked<DataSource>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockInventoryQueryService: DeepMocked<InventoryQueryService>;
  let mockTransactionService: DeepMocked<TransactionService>;

  beforeEach(async () => {
    mockStockTransRepo = createMock<Repository<StockTransaction>>();
    mockStockRepo = createMock<Repository<MatStock>>();
    mockLotRepo = createMock<Repository<MatLot>>();
    mockWarehouseRepo = createMock<Repository<Warehouse>>();
    mockItemMasterRepo = createMock<Repository<ItemMaster>>();
    mockDataSource = createMock<DataSource>();
    mockQueryRunner = createMock<QueryRunner>();
    mockInventoryQueryService = createMock<InventoryQueryService>();
    mockTransactionService = createMock<TransactionService>();

    // QueryRunner 체인 모킹
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);
    mockTransactionService.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));
    mockLotRepo.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(StockTransaction), useValue: mockStockTransRepo },
        { provide: getRepositoryToken(MatStock), useValue: mockStockRepo },
        { provide: getRepositoryToken(MatLot), useValue: mockLotRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: mockItemMasterRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: InventoryQueryService, useValue: mockInventoryQueryService },
        { provide: TransactionService, useValue: mockTransactionService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes tenant columns in material stock primary key metadata', () => {
    const primaryColumnNames = getMetadataArgsStorage()
      .columns
      .filter(column => column.target === MatStock && column.options.primary)
      .map(column => column.propertyName);

    expect(primaryColumnNames).toEqual(
      expect.arrayContaining(['company', 'plant', 'warehouseCode', 'itemCode', 'matUid']),
    );
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

    it('searches the last UID within tenant context when tenant is provided', async () => {
      // Arrange
      const today = new Date();
      const prefix = `RM${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      mockLotRepo.findOne.mockResolvedValue({ matUid: `${prefix}0007` } as MatLot);

      // Act
      const result = await target.generateMatUid('RM', 'TESTV', 'WAREHOUSES');

      // Assert
      expect(result).toBe(`${prefix}0008`);
      expect(mockLotRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          company: 'TESTV',
          plant: 'WAREHOUSES',
        }),
      }));
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

    it('persists company and plant from tenant context', async () => {
      // Arrange
      const dto = {
        matUid: 'RM202603180001',
        itemCode: 'PART-001',
        initQty: 100,
        recvDate: '2026-03-18',
        vendor: 'VENDOR-A',
      };
      const savedLot = { ...dto, company: 'TESTV', plant: 'WAREHOUSES' } as any;
      mockLotRepo.create.mockReturnValue(savedLot);
      mockLotRepo.save.mockResolvedValue(savedLot);

      // Act
      const result = await (target as any).createLot(dto, 'TESTV', 'WAREHOUSES');

      // Assert
      expect(result).toEqual(savedLot);
      expect(mockLotRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        matUid: 'RM202603180001',
        itemCode: 'PART-001',
        company: 'TESTV',
        plant: 'WAREHOUSES',
      }));
    });

    it('rejects duplicate matUid only within the same tenant', async () => {
      // Arrange
      const dto = {
        matUid: 'RM202603180001',
        itemCode: 'PART-001',
        initQty: 100,
        recvDate: '2026-03-18',
      };
      mockLotRepo.findOne.mockResolvedValue({ matUid: 'RM202603180001', company: 'TESTV', plant: 'WAREHOUSES' } as MatLot);

      // Act & Assert
      await expect(target.createLot(dto as any, 'TESTV', 'WAREHOUSES')).rejects.toThrow(BadRequestException);
      expect(mockLotRepo.findOne).toHaveBeenCalledWith({
        where: {
          matUid: 'RM202603180001',
          company: 'TESTV',
          plant: 'WAREHOUSES',
        },
      });
      expect(mockLotRepo.save).not.toHaveBeenCalled();
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
      expect(mockTransactionService.run).toHaveBeenCalledTimes(1);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2); // transaction + stock
    });

    it('uses existing transaction number prefix to generate the next sequence', async () => {
      // Arrange
      const today = new Date();
      const prefix = `TRX${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      mockStockTransRepo.findOne.mockResolvedValue({ transNo: `${prefix}00007` } as StockTransaction);
      mockStockTransRepo.create.mockImplementation((value: any) => value);
      mockQueryRunner.manager.save.mockImplementation(async (_entity: any, value: any) => value);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      // Act
      await target.receiveStock(receiveDto as any);

      // Assert
      expect(mockStockTransRepo.findOne).toHaveBeenCalledWith({
        where: { transNo: Like(`${prefix}%`) },
        order: { transNo: 'DESC' },
      });
      expect(mockStockTransRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        transNo: `${prefix}00008`,
      }));
    });

    it('persists company and plant on transaction and new stock', async () => {
      // Arrange
      const savedTrans = { transNo: 'TRX202603180001', ...receiveDto, company: 'TESTV', plant: 'WAREHOUSES' } as any;
      mockStockTransRepo.create.mockReturnValue(savedTrans);
      mockQueryRunner.manager.save.mockResolvedValue(savedTrans);
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      // Act
      await (target as any).receiveStock(receiveDto, 'TESTV', 'WAREHOUSES');

      // Assert
      expect(mockStockTransRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        company: 'TESTV',
        plant: 'WAREHOUSES',
      }));
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(MatStock, expect.objectContaining({
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        company: 'TESTV',
        plant: 'WAREHOUSES',
      }));
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
      expect(mockTransactionService.run).toHaveBeenCalledTimes(1);
    });

    it('should rollback on error', async () => {
      // Arrange
      mockStockTransRepo.create.mockReturnValue({} as any);
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(target.receiveStock(receiveDto as any)).rejects.toThrow('DB error');
      expect(mockTransactionService.run).toHaveBeenCalledTimes(1);
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
      expect(mockTransactionService.run).toHaveBeenCalledTimes(1);
    });

    it('persists company and plant on issue transaction', async () => {
      // Arrange
      const existingStock = {
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 100,
        reservedQty: 0,
        availableQty: 100,
      };
      const savedTrans = { transNo: 'TRX202603180001', qty: -30, company: 'TESTV', plant: 'WAREHOUSES' } as any;
      mockStockTransRepo.create.mockReturnValue(savedTrans);
      mockQueryRunner.manager.findOne.mockResolvedValue(existingStock);
      mockQueryRunner.manager.save.mockResolvedValue(savedTrans);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await (target as any).issueStock(issueDto, 'TESTV', 'WAREHOUSES');

      // Assert
      expect(mockStockTransRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        company: 'TESTV',
        plant: 'WAREHOUSES',
      }));
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
      expect(mockTransactionService.run).toHaveBeenCalledTimes(1);
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
      expect(mockTransactionService.run).toHaveBeenCalledTimes(1);
    });

    it('persists company and plant on transfer target stock when newly created', async () => {
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
      const savedTrans = { transNo: 'TRX202603180001', qty: -30, company: 'TESTV', plant: 'WAREHOUSES' } as any;
      mockStockTransRepo.create.mockReturnValue(savedTrans);
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(sourceStock)
        .mockResolvedValueOnce(null);
      mockQueryRunner.manager.save.mockResolvedValue(savedTrans);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

      // Act
      await (target as any).issueStock(issueDtoWithTarget, 'TESTV', 'WAREHOUSES');

      // Assert
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(MatStock, expect.objectContaining({
        warehouseCode: 'WH-WIP',
        itemCode: 'PART-001',
        company: 'TESTV',
        plant: 'WAREHOUSES',
      }));
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
      expect(mockTransactionService.run).toHaveBeenCalledTimes(1);
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

    it('marks original transaction canceled within the original tenant only', async () => {
      const originalTrans = {
        transNo: 'TRX202603180001',
        transType: 'MAT_OUT',
        fromWarehouseId: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: -10,
        status: 'DONE',
        company: 'TESTV',
        plant: 'WAREHOUSES',
      };
      const cancelTrans = { transNo: 'TRX202603180002', transType: 'MAT_OUT_CANCEL', qty: 10 } as any;
      mockStockTransRepo.findOne.mockResolvedValueOnce(originalTrans as any);
      mockStockTransRepo.findOne.mockResolvedValue(null);
      mockStockTransRepo.create.mockReturnValue(cancelTrans);
      mockQueryRunner.manager.save.mockResolvedValue(cancelTrans);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 20,
        availableQty: 20,
        company: 'TESTV',
        plant: 'WAREHOUSES',
      } as any);

      await target.cancelTransaction({ transactionId: 'TRX202603180001' } as any, 'TESTV', 'WAREHOUSES');

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        StockTransaction,
        { transNo: 'TRX202603180001', company: 'TESTV', plant: 'WAREHOUSES' },
        { status: 'CANCELED' },
      );
    });

    it('rejects cancellation when requested tenant differs from original transaction tenant', async () => {
      mockStockTransRepo.findOne.mockResolvedValueOnce({
        transNo: 'TRX202603180001',
        transType: 'MAT_OUT',
        fromWarehouseId: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: -10,
        status: 'DONE',
        company: 'ORIGINAL',
        plant: 'P01',
      } as any);

      await expect(
        target.cancelTransaction({ transactionId: 'TRX202603180001' } as any, 'REQUEST', 'P01'),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionService.run).not.toHaveBeenCalled();
    });

    it('rejects cancellation when restored stock belongs to a different tenant', async () => {
      mockStockTransRepo.findOne.mockResolvedValueOnce({
        transNo: 'TRX202603180001',
        transType: 'MAT_OUT',
        fromWarehouseId: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: -10,
        status: 'DONE',
        company: 'TESTV',
        plant: 'WAREHOUSES',
      } as any);
      mockStockTransRepo.findOne.mockResolvedValue(null);
      mockStockTransRepo.create.mockReturnValue({ transNo: 'TRX202603180002' } as any);
      mockQueryRunner.manager.save.mockResolvedValue({ transNo: 'TRX202603180002' } as any);
      mockQueryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH-RM',
        itemCode: 'PART-001',
        matUid: 'RM202603180001',
        qty: 20,
        availableQty: 20,
        company: 'OTHER',
        plant: 'WAREHOUSES',
      } as any);

      await expect(
        target.cancelTransaction({ transactionId: 'TRX202603180001' } as any, 'TESTV', 'WAREHOUSES'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // getStock
  // ─────────────────────────────────────────────
  describe('getStock', () => {
    it('delegates to InventoryQueryService with tenant context', async () => {
      const expected = [{ warehouseCode: 'WH-RM' }];
      mockInventoryQueryService.getStock.mockResolvedValue(expected as any);

      const result = await target.getStock({ warehouseCode: 'WH-RM' } as any, 'TESTV', 'WAREHOUSES');

      expect(result).toBe(expected);
      expect(mockInventoryQueryService.getStock).toHaveBeenCalledWith(
        { warehouseCode: 'WH-RM' },
        'TESTV',
        'WAREHOUSES',
      );
    });
  });

  // ─────────────────────────────────────────────
  // getLotById
  // ─────────────────────────────────────────────
  describe('getLotById', () => {
    it('delegates to InventoryQueryService with tenant context', async () => {
      const expected = { matUid: 'RM001' };
      mockInventoryQueryService.getLotById.mockResolvedValue(expected as any);

      const result = await target.getLotById('RM001', 'TESTV', 'WAREHOUSES');

      expect(result).toBe(expected);
      expect(mockInventoryQueryService.getLotById).toHaveBeenCalledWith('RM001', 'TESTV', 'WAREHOUSES');
    });
  });

  // ─────────────────────────────────────────────
  // getTransactionById
  // ─────────────────────────────────────────────
  describe('getTransactionById', () => {
    it('delegates to InventoryQueryService with tenant context', async () => {
      const expected = { transNo: 'TRX001' };
      mockInventoryQueryService.getTransactionById.mockResolvedValue(expected as any);

      const result = await target.getTransactionById('TRX001', 'TESTV', 'WAREHOUSES');

      expect(result).toBe(expected);
      expect(mockInventoryQueryService.getTransactionById).toHaveBeenCalledWith('TRX001', 'TESTV', 'WAREHOUSES');
    });
  });

  // ─────────────────────────────────────────────
  // getStockSummary
  // ─────────────────────────────────────────────
  describe('getStockSummary', () => {
    it('delegates to InventoryQueryService with tenant context', async () => {
      const expected = [{ itemCode: 'PART-001', totalQty: 150 }];
      mockInventoryQueryService.getStockSummary.mockResolvedValue(expected as any);

      const result = await target.getStockSummary({ warehouseType: 'RM' }, 'TESTV', 'WAREHOUSES');

      expect(result).toBe(expected);
      expect(mockInventoryQueryService.getStockSummary).toHaveBeenCalledWith({ warehouseType: 'RM' }, 'TESTV', 'WAREHOUSES');
    });
  });
});
