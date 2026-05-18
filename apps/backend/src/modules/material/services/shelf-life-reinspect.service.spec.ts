import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ShelfLifeReInspectService } from './shelf-life-reinspect.service';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { MockLoggerService } from '../../../common/test/mock-logger.service';

describe('ShelfLifeReInspectService', () => {
  let service: ShelfLifeReInspectService;
  let iqcLogRepo: DeepMocked<Repository<IqcLog>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let matStockRepo: DeepMocked<Repository<MatStock>>;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let partMasterRepo: DeepMocked<Repository<PartMaster>>;
  let dataSource: DeepMocked<DataSource>;
  let numbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    iqcLogRepo = createMock<Repository<IqcLog>>();
    matLotRepo = createMock<Repository<MatLot>>();
    matStockRepo = createMock<Repository<MatStock>>();
    stockTxRepo = createMock<Repository<StockTransaction>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    partMasterRepo = createMock<Repository<PartMaster>>();
    dataSource = createMock<DataSource>();
    numbering = createMock<NumberingService>();

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
  });
});
