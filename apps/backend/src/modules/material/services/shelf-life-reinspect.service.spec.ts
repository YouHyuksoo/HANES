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
import { PartMaster } from '../../../entities/part-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('ShelfLifeReInspectService', () => {
  let service: ShelfLifeReInspectService;
  let iqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let partMasterRepo: DeepMocked<Repository<PartMaster>>;
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
    partMasterRepo = createMock<Repository<PartMaster>>();
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
        { provide: getRepositoryToken(PartMaster), useValue: partMasterRepo },
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
    it('재검 PASS는 LOT의 회사/공장 범위에서 품목 기준과 LOT 만료일을 갱신한다', async () => {
      const expireDate = new Date('2026-01-01T00:00:00.000Z');
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        expireDate,
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      partMasterRepo.findOne.mockResolvedValue({ itemCode: 'ITEM-001', extendShelfDays: 30 } as any);
      iqcLogRepo.create.mockReturnValue({} as IqcLog);
      iqcLogRepo.save.mockResolvedValue({ inspectNo: 'IQC-001' } as any);

      await service.create({ matUid: 'MAT-001', result: 'PASS' }, 'HANES', 'P01');

      expect(partMasterRepo.findOne).toHaveBeenCalledWith({
        where: { itemCode: 'ITEM-001', company: 'HANES', plant: 'P01' },
      });
      expect(matLotRepo.update).toHaveBeenCalledWith(
        { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
        { expireDate: new Date('2026-01-31T00:00:00.000Z') },
      );
    });

    it('예약된 수량이 남아 있으면 재검 FAIL 이동을 차단한다', async () => {
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      iqcLogRepo.create.mockReturnValue({} as IqcLog);
      iqcLogRepo.save.mockResolvedValue({ inspectNo: 'IQC-001' } as any);
      matStockRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 10,
        availableQty: 4,
        reservedQty: 6,
        warehouseCode: 'WH-01',
      } as MatStock);
      warehouseRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-DEF',
        warehouseType: 'DEFECT',
        useYn: 'Y',
      } as Warehouse);

      await expect(
        service.create({ matUid: 'MAT-001', result: 'FAIL' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('재검 FAIL 자동 이동은 TransactionService로 재고 이동과 이력을 함께 저장한다', async () => {
      matLotRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        company: 'HANES',
        plant: 'P01',
      } as MatLot);
      iqcLogRepo.create.mockReturnValue({} as IqcLog);
      iqcLogRepo.save.mockResolvedValue({ inspectNo: 'IQC-001' } as any);
      matStockRepo.findOne.mockResolvedValue({
        matUid: 'MAT-001',
        itemCode: 'ITEM-001',
        qty: 10,
        availableQty: 10,
        reservedQty: 0,
        warehouseCode: 'WH-01',
      } as MatStock);
      warehouseRepo.findOne.mockResolvedValue({
        warehouseCode: 'WH-DEF',
        warehouseType: 'DEFECT',
        useYn: 'Y',
      } as Warehouse);
      queryRunner.manager.findOne.mockResolvedValue(null);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);
      queryRunner.manager.save.mockResolvedValue({} as any);

      await service.create({ matUid: 'MAT-001', result: 'FAIL' });

      expect(tx.run).toHaveBeenCalledTimes(1);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        StockTransaction,
        expect.objectContaining({ transType: 'MAT_MOVE', matUid: 'MAT-001' }),
      );
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        MatLot,
        { matUid: 'MAT-001', company: 'HANES', plant: 'P01' },
        { status: 'SCRAPPED' },
      );
    });
  });
});
