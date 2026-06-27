import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ScrapService } from './scrap.service';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ScrapService', () => {
  let service: ScrapService;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let itemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;
  let numbering: DeepMocked<NumberingService>;
  let sysConfigService: DeepMocked<SysConfigService>;

  beforeEach(async () => {
    stockTxRepo = createMock<Repository<StockTransaction>>();
    matLotRepo = createMock<Repository<MatLot>>();
    matStockRepo = createMock<Repository<MatStock>>();
    itemMasterRepo = createMock<Repository<ItemMaster>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();
    numbering = createMock<NumberingService>();
    sysConfigService = createMock<SysConfigService>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);
    warehouseRepo.findOne.mockResolvedValue(null);
    sysConfigService.getValue.mockResolvedValue('CANCEL' as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScrapService,
        { provide: getRepositoryToken(StockTransaction), useValue: stockTxRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemMasterRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: numbering },
        { provide: SysConfigService, useValue: sysConfigService },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(ScrapService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('품목/LOT 마스터가 누락되어도 폐기 이력의 수불 원본 itemCode와 matUid는 유지한다', async () => {
      stockTxRepo.find.mockResolvedValue([
        {
          transNo: 'TX-SCRAP-001',
          transType: 'SCRAP',
          itemCode: 'ITEM-MISSING',
          matUid: 'MAT-MISSING',
          qty: 3,
        } as StockTransaction,
      ]);
      stockTxRepo.count.mockResolvedValue(1);
      itemMasterRepo.find.mockResolvedValue([]);
      matLotRepo.find.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          transNo: 'TX-SCRAP-001',
          itemCode: 'ITEM-MISSING',
          itemName: null,
          matUid: 'MAT-MISSING',
        }),
      );
    });

    it('폐기 이력 보강 조회도 요청 테넌트 범위로 제한한다', async () => {
      stockTxRepo.find.mockResolvedValue([
        {
          transNo: 'TX-SCRAP-001',
          transType: 'SCRAP',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 3,
          company: 'C1',
          plant: 'P1',
        } as StockTransaction,
      ]);
      stockTxRepo.count.mockResolvedValue(1);
      itemMasterRepo.find.mockResolvedValue([]);
      matLotRepo.find.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10 }, 'C1', 'P1');

      expect(itemMasterRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
      expect(matLotRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      });
    });
  });

  describe('create', () => {
    it('LOT가 없으면 폐기를 차단한다', async () => {
      queryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create({ matUid: 'NONE', warehouseId: 'WH-01', qty: 10, reason: '폐기' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('예약된 수량이 있으면 가용재고 범위 밖 폐기를 차단한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 2,
          reservedQty: 8,
        } as MatStock);

      await expect(
        service.create({ matUid: 'MAT-001', warehouseId: 'WH-01', qty: 5, reason: '폐기' } as any),
      ).rejects.toThrow(BadRequestException);

      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('폐기는 TransactionService로 재고 차감과 폐기 이력을 함께 저장한다', async () => {
      numbering.nextInTx.mockResolvedValue('TX-001');
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 10,
        } as MatStock);
      (queryRunner.manager.create as jest.Mock).mockReturnValue({ transNo: 'TX-001' } as StockTransaction);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({ transNo: 'TX-001' } as StockTransaction);

      const result = await service.create({
        matUid: 'MAT-001',
        warehouseId: 'WH-01',
        qty: 3,
        reason: '폐기',
      } as any);

      expect(result.transNo).toBe('TX-001');
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001' },
        expect.objectContaining({ qty: 7, availableQty: 7 }),
      );
      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('폐기 등록도 창고/LOT/재고를 요청 테넌트 범위로 제한한다', async () => {
      numbering.nextInTx.mockResolvedValue('TX-001');
      warehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'WH-01', warehouseType: 'RAW', company: 'C1', plant: 'P1' } as Warehouse);
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 10,
          company: 'C1',
          plant: 'P1',
        } as MatStock);
      (queryRunner.manager.create as jest.Mock).mockReturnValue({ transNo: 'TX-001' } as StockTransaction);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({ transNo: 'TX-001' } as StockTransaction);

      await service.create({
        matUid: 'MAT-001',
        warehouseId: 'WH-01',
        qty: 3,
        reason: '폐기',
      } as any, 'C1', 'P1');

      expect(warehouseRepo.findOne).toHaveBeenCalledWith({
        where: { warehouseCode: 'WH-01', company: 'C1', plant: 'P1' },
      });
      expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(1, MatLot, {
        where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(queryRunner.manager.findOne).toHaveBeenNthCalledWith(2, MatStock, {
        where: { itemCode: 'ITEM-001', warehouseCode: 'WH-01', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
      });
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatStock,
        { warehouseCode: 'WH-01', itemCode: 'ITEM-001', matUid: 'MAT-001', company: 'C1', plant: 'P1' },
        expect.objectContaining({ qty: 7, availableQty: 7 }),
      );
    });

    it('요청 테넌트와 LOT 테넌트가 다르면 폐기를 차단한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'OTHER', plant: 'P1' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 10,
          company: 'C1',
          plant: 'P1',
        } as MatStock);

      await expect(service.create({
        matUid: 'MAT-001',
        warehouseId: 'WH-01',
        qty: 3,
        reason: '폐기',
      } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);

      expect(queryRunner.manager.update).not.toHaveBeenCalled();
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('요청 테넌트와 재고 테넌트가 다르면 폐기를 차단한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ matUid: 'MAT-001', itemCode: 'ITEM-001', company: 'C1', plant: 'P1' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          availableQty: 10,
          company: 'OTHER',
          plant: 'P1',
        } as MatStock);

      await expect(service.create({
        matUid: 'MAT-001',
        warehouseId: 'WH-01',
        qty: 3,
        reason: '폐기',
      } as any, 'C1', 'P1')).rejects.toThrow(BadRequestException);

      expect(queryRunner.manager.update).not.toHaveBeenCalled();
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });
  });
});
