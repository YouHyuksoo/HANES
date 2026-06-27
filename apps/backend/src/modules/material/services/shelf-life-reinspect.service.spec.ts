import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { ShelfLifeReInspectService } from './shelf-life-reinspect.service';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ShelfLifeReInspectService', () => {
  let service: ShelfLifeReInspectService;
  let iqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let itemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;
  let numbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    iqcLogRepo = createMock<Repository<IqcLog>>();
    matLotRepo = createMock<Repository<MatLot>>();
    matStockRepo = createMock<Repository<MatStock>>();
    stockTxRepo = createMock<Repository<StockTransaction>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    itemMasterRepo = createMock<Repository<ItemMaster>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();
    numbering = createMock<NumberingService>();
    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));
    numbering.nextInTx.mockResolvedValue('TX-001');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShelfLifeReInspectService,
        { provide: getRepositoryToken(IqcLog), useValue: iqcLogRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: stockTxRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemMasterRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: numbering },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(ShelfLifeReInspectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('재검 PASS는 검사일 + 연장일 기준으로 LOT 만료일을 갱신한다', async () => {
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        expireDate: new Date('2026-01-01'),
        status: 'NORMAL',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      itemMasterRepo.findOne.mockResolvedValue({
        itemCode: 'ITEM-001',
        expiryExtDays: 90,
      } as ItemMaster);
      iqcLogRepo.count.mockResolvedValue(0);
      iqcLogRepo.create.mockReturnValue({} as IqcLog);
      iqcLogRepo.save.mockResolvedValue({ inspectDate: new Date(), seq: 1 } as any);

      await service.create({ matUid: 'MAT-001', result: 'PASS' }, 'HANES', 'P01');

      expect(matLotRepo.update).toHaveBeenCalledWith(
        { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
        { expireDate: expect.any(Date) },
      );
    });

    it('dto.extendDays가 품목 최대 연장일을 초과하면 BadRequestException 발생', async () => {
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        status: 'NORMAL',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      itemMasterRepo.findOne.mockResolvedValue({
        itemCode: 'ITEM-001',
        expiryExtDays: 90,
      } as ItemMaster);
      iqcLogRepo.count.mockResolvedValue(0);
      iqcLogRepo.create.mockReturnValue({} as IqcLog);
      iqcLogRepo.save.mockResolvedValue({ inspectDate: new Date(), seq: 1 } as any);

      await expect(
        service.create({ matUid: 'MAT-001', result: 'PASS', extendDays: 200 }, 'HANES', 'P01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('예약된 수량이 남아 있으면 재검 FAIL 이동을 차단한다', async () => {
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        status: 'NORMAL',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      itemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', expiryExtDays: 90 } as ItemMaster);
      iqcLogRepo.count.mockResolvedValue(0);
      iqcLogRepo.create.mockReturnValue({} as IqcLog);
      iqcLogRepo.save.mockResolvedValue({ inspectDate: new Date(), seq: 1 } as any);
      matStockRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 10,
        availableQty: 4,
        reservedQty: 6,
        warehouseCode: 'WH-01',
        company: 'HANES',
        plant: 'P01',
      } as MatStock);
      warehouseRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-DEF',
        warehouseType: 'DEFECT',
        useYn: 'Y',
        company: 'HANES',
        plant: 'P01',
      } as Warehouse);

      await expect(
        service.create({ matUid: 'MAT-001', result: 'FAIL' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('재검 FAIL 대상 재고가 LOT 회사/공장과 다르면 자동 이동하지 않는다', async () => {
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        status: 'NORMAL',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      itemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', expiryExtDays: 90 } as ItemMaster);
      iqcLogRepo.count.mockResolvedValue(0);
      iqcLogRepo.create.mockReturnValue({} as IqcLog);
      iqcLogRepo.save.mockResolvedValue({ inspectDate: new Date(), seq: 1 } as any);
      warehouseRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-DEF',
        warehouseType: 'DEFECT',
        useYn: 'Y',
        company: 'HANES',
        plant: 'P01',
      } as Warehouse);
      matStockRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 10,
        availableQty: 10,
        reservedQty: 0,
        warehouseCode: 'WH-01',
        company: 'OTHER',
        plant: 'P01',
      } as MatStock);

      await expect(
        service.create({ matUid: 'MAT-001', result: 'FAIL' }, 'HANES', 'P01'),
      ).rejects.toThrow('회사 정보가 일치하지 않습니다');

      expect(tx.run).not.toHaveBeenCalled();
    });

    it('재검 FAIL 자동 이동은 TransactionService로 재고 이동과 DISCARDED 처리를 함께 저장한다', async () => {
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        status: 'NORMAL',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      itemMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', expiryExtDays: 90 } as ItemMaster);
      iqcLogRepo.count.mockResolvedValue(1);
      iqcLogRepo.create.mockReturnValue({} as IqcLog);
      iqcLogRepo.save.mockResolvedValue({ inspectDate: new Date(), seq: 1 } as any);
      matStockRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 10,
        availableQty: 10,
        reservedQty: 0,
        warehouseCode: 'WH-01',
        company: 'HANES',
        plant: 'P01',
      } as MatStock);
      warehouseRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-DEF',
        warehouseType: 'DEFECT',
        useYn: 'Y',
        company: 'HANES',
        plant: 'P01',
      } as Warehouse);
      queryRunner.manager.findOne.mockResolvedValue(null);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      queryRunner.manager.save.mockResolvedValue({} as any);

      const result = await service.create({ matUid: 'MAT-001', result: 'FAIL' });

      expect(result.retestRound).toBe(2);
      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      // 양품창고 출고(-) / 불용창고 입고(+) 2건으로 수불 기록
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        StockTransaction,
        expect.objectContaining({ transType: 'MAT_MOVE_OUT', matUid: 'MAT-001', qty: expect.any(Number) }),
      );
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        StockTransaction,
        expect.objectContaining({ transType: 'MAT_MOVE_IN', matUid: 'MAT-001' }),
      );
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatLot,
        expect.objectContaining({ matUid: 'MAT-001' }),
        { status: 'DISCARDED' },
      );
    });
  });
});
