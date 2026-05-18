import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { AdjustmentService } from './adjustment.service';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('AdjustmentService', () => {
  let service: AdjustmentService;
  let invAdjLogRepo: DeepMocked<Repository<InvAdjLog>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let partMasterRepo: DeepMocked<Repository<PartMaster>>;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let dataSource: DeepMocked<DataSource>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    invAdjLogRepo = createMock<Repository<InvAdjLog>>();
    matStockRepo = createMock<Repository<MatStock>>();
    matLotRepo = createMock<Repository<MatLot>>();
    partMasterRepo = createMock<Repository<PartMaster>>();
    stockTxRepo = createMock<Repository<StockTransaction>>();
    dataSource = createMock<DataSource>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdjustmentService,
        { provide: getRepositoryToken(InvAdjLog), useValue: invAdjLogRepo },
        { provide: getRepositoryToken(MatStock), useValue: matStockRepo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(PartMaster), useValue: partMasterRepo },
        { provide: getRepositoryToken(StockTransaction), useValue: stockTxRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get(AdjustmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPending', () => {
    it('예약수량보다 적게 보정 요청하면 차단한다', async () => {
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ itemCode: 'ITEM-001', itemName: 'PART' } as PartMaster)
        .mockResolvedValueOnce({ matUid: 'MAT-001' } as MatLot)
        .mockResolvedValueOnce({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          qty: 10,
          reservedQty: 6,
          company: 'HANES',
          plant: 'P01',
        } as MatStock);

      await expect(
        service.createPending({
          warehouseCode: 'WH-01',
          itemCode: 'ITEM-001',
          matUid: 'MAT-001',
          afterQty: 5,
          reason: '보정',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('예약수량보다 적게 승인 반영하면 차단한다', async () => {
      invAdjLogRepo.findOne.mockResolvedValue({
        adjDate: new Date('2026-04-11'),
        seq: 1,
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        afterQty: 5,
        diffQty: -5,
        reason: '보정',
        adjustStatus: 'PENDING',
        company: 'HANES',
        plant: 'P01',
      } as InvAdjLog);
      queryRunner.manager.findOne.mockResolvedValue({
        warehouseCode: 'WH-01',
        itemCode: 'ITEM-001',
        matUid: 'MAT-001',
        qty: 10,
        reservedQty: 6,
      } as MatStock);

      await expect(service.approve('2026-04-11', 1, 'admin')).rejects.toThrow(BadRequestException);
    });
  });
});
