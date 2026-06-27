import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryQueryService } from './inventory-query.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('InventoryQueryService', () => {
  let service: InventoryQueryService;
  let stockTransactionRepo: DeepMocked<Repository<StockTransaction>>;
  let stockRepo: DeepMocked<Repository<MatStock>>;
  let lotRepo: DeepMocked<Repository<MatLot>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let partRepo: DeepMocked<Repository<ItemMaster>>;

  beforeEach(async () => {
    stockTransactionRepo = createMock<Repository<StockTransaction>>();
    stockRepo = createMock<Repository<MatStock>>();
    lotRepo = createMock<Repository<MatLot>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    partRepo = createMock<Repository<ItemMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryQueryService,
        { provide: getRepositoryToken(StockTransaction), useValue: stockTransactionRepo },
        { provide: getRepositoryToken(MatStock), useValue: stockRepo },
        { provide: getRepositoryToken(MatLot), useValue: lotRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: partRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(InventoryQueryService);
  });

  afterEach(() => jest.clearAllMocks());

  it('현재고 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
    stockRepo.find.mockResolvedValue([
      { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', qty: 10, reservedQty: 0, availableQty: 10 } as MatStock,
    ]);
    warehouseRepo.find.mockResolvedValue([]);
    partRepo.find.mockResolvedValue([]);
    lotRepo.find.mockResolvedValue([]);

    await service.getStock({}, 'C1', 'P1');

    expect(warehouseRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      select: ['warehouseCode', 'warehouseName', 'warehouseType'],
    });
    expect(partRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      select: ['itemCode', 'itemName', 'itemType', 'unit'],
    });
    expect(lotRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      select: ['matUid', 'status'],
    });
  });

  it('수불 이력 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          transNo: 'TX-001',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          fromWarehouseId: 'WH-01',
          toWarehouseId: 'WH-02',
          company: 'C1',
          plant: 'P1',
        } as StockTransaction,
      ]),
    };
    stockTransactionRepo.createQueryBuilder.mockReturnValue(qb as any);
    warehouseRepo.find.mockResolvedValue([]);
    partRepo.find.mockResolvedValue([]);
    lotRepo.find.mockResolvedValue([]);

    await service.getTransactions({}, 'C1', 'P1');

    expect(warehouseRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
    });
    expect(partRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
    });
    expect(lotRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
    });
  });

  it('자재 수불 취소 화면에서 사용할 id로 transNo를 함께 반환한다', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { transNo: 'TX-001', itemCode: 'ITEM-001', matUid: 'MAT-001' } as StockTransaction,
      ]),
    };
    stockTransactionRepo.createQueryBuilder.mockReturnValue(qb as any);
    warehouseRepo.find.mockResolvedValue([]);
    partRepo.find.mockResolvedValue([]);
    lotRepo.find.mockResolvedValue([]);

    const result = await service.getTransactions({} as any);

    expect(result[0]).toEqual(expect.objectContaining({ id: 'TX-001', transNo: 'TX-001' }));
  });

  it('LOT 상세 조회도 요청 테넌트 범위로 제한한다', async () => {
    lotRepo.findOne.mockResolvedValue({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as MatLot);
    partRepo.findOne.mockResolvedValue(null);
    stockRepo.find.mockResolvedValue([{ warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001' } as MatStock]);
    stockTransactionRepo.find.mockResolvedValue([]);
    warehouseRepo.find.mockResolvedValue([]);

    await service.getLotById('MAT-001', 'C1', 'P1');

    expect(lotRepo.findOne).toHaveBeenCalledWith({
      where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
    });
    expect(partRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'ITEM-001', company: 'C1', plant: 'P1' },
    });
    expect(stockRepo.find).toHaveBeenCalledWith({
      where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
    });
  });

  it('재고 집계 조회도 요청 테넌트 범위로 제한한다', async () => {
    stockRepo.find.mockResolvedValue([
      { warehouseCode: 'WH-01', itemCode: 'ITEM-001', qty: 10, company: 'C1', plant: 'P1' } as MatStock,
    ]);
    warehouseRepo.find.mockResolvedValue([]);
    partRepo.find.mockResolvedValue([]);

    await service.getStockSummary({}, 'C1', 'P1');

    expect(stockRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      select: ['warehouseCode', 'itemCode', 'qty'],
    });
    expect(warehouseRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      select: ['warehouseCode', 'warehouseName', 'warehouseType'],
    });
    expect(partRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      select: ['itemCode', 'itemName', 'itemType'],
    });
  });
});
