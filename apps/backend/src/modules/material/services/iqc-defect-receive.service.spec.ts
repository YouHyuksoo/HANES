import { Test } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IqcDefectReceiveService } from './iqc-defect-receive.service';
import { IqcHistoryService } from './iqc-history.service';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';

describe('IqcDefectReceiveService (수동입고, 2026-09-11 06번)', () => {
  let target: IqcDefectReceiveService;
  let matLotRepo: DeepMocked<Repository<MatLot>>;
  let arrivalStockRepo: DeepMocked<Repository<MatArrivalStock>>;
  let stockTxRepo: DeepMocked<Repository<StockTransaction>>;
  let warehouseRepo: DeepMocked<Repository<Warehouse>>;
  let iqcHistory: DeepMocked<IqcHistoryService>;

  beforeEach(async () => {
    matLotRepo = createMock<Repository<MatLot>>();
    arrivalStockRepo = createMock<Repository<MatArrivalStock>>();
    stockTxRepo = createMock<Repository<StockTransaction>>();
    warehouseRepo = createMock<Repository<Warehouse>>();
    iqcHistory = createMock<IqcHistoryService>();
    const module = await Test.createTestingModule({
      providers: [
        IqcDefectReceiveService,
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
        { provide: getRepositoryToken(MatArrivalStock), useValue: arrivalStockRepo },
        { provide: getRepositoryToken(MatStock), useValue: createMock<Repository<MatStock>>() },
        { provide: getRepositoryToken(IqcLog), useValue: createMock<Repository<IqcLog>>() },
        { provide: getRepositoryToken(StockTransaction), useValue: stockTxRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: IqcHistoryService, useValue: iqcHistory },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: TransactionService, useValue: createMock<TransactionService>() },
      ],
    }).compile();
    target = module.get(IqcDefectReceiveService);
  });

  it('DEFECT 유형이 아닌 창고로는 입고할 수 없다', async () => {
    warehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'W001', warehouseType: 'RAW', useYn: 'Y' } as Warehouse);
    await expect(target.receive({ matUids: ['S-1'], warehouseCode: 'W001' }, 'C1', 'P1')).rejects.toThrow(BadRequestException);
    expect(iqcHistory.moveLotToDefectWarehouse).not.toHaveBeenCalled();
  });

  it('없는 창고는 NotFound', async () => {
    warehouseRepo.findOne.mockResolvedValue(null);
    await expect(target.receive({ matUids: ['S-1'], warehouseCode: 'NOPE' }, 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });

  it('FAIL·특채아님·NORMAL·입하재고>0 시리얼만 이동하고 나머지는 실패 사유로 돌려준다', async () => {
    warehouseRepo.findOne.mockResolvedValue({ warehouseCode: 'DEFECT', warehouseType: 'DEFECT', useYn: 'Y' } as Warehouse);
    matLotRepo.find.mockResolvedValue([
      { matUid: 'S-FAIL', itemCode: 'ITEM', iqcStatus: 'FAIL', specialAcceptYn: 'N', status: 'NORMAL', company: 'C1', plant: 'P1' },
      { matUid: 'S-PASS', itemCode: 'ITEM', iqcStatus: 'PASS', specialAcceptYn: 'N', status: 'NORMAL', company: 'C1', plant: 'P1' },
      { matUid: 'S-CONC', itemCode: 'ITEM', iqcStatus: 'FAIL', specialAcceptYn: 'Y', status: 'NORMAL', company: 'C1', plant: 'P1' },
      { matUid: 'S-EMPTY', itemCode: 'ITEM', iqcStatus: 'FAIL', specialAcceptYn: 'N', status: 'NORMAL', company: 'C1', plant: 'P1' },
    ] as MatLot[]);
    arrivalStockRepo.find.mockResolvedValue([
      { matUid: 'S-FAIL', qty: 100 }, { matUid: 'S-PASS', qty: 50 }, { matUid: 'S-CONC', qty: 10 }, { matUid: 'S-EMPTY', qty: 0 },
    ] as MatArrivalStock[]);
    iqcHistory.moveLotToDefectWarehouse.mockResolvedValue('STX-1');

    const result = await target.receive({ matUids: ['S-FAIL', 'S-PASS', 'S-CONC', 'S-EMPTY', 'S-NONE'], warehouseCode: 'DEFECT', remark: 'r' }, 'C1', 'P1');

    expect(result.done).toEqual([{ matUid: 'S-FAIL', qty: 100, transNo: 'STX-1' }]);
    expect(result.failed.map((f) => f.matUid).sort()).toEqual(['S-CONC', 'S-EMPTY', 'S-NONE', 'S-PASS']);
    expect(iqcHistory.moveLotToDefectWarehouse).toHaveBeenCalledTimes(1);
    expect(iqcHistory.moveLotToDefectWarehouse).toHaveBeenCalledWith(expect.objectContaining({
      matUid: 'S-FAIL', defectWarehouseCode: 'DEFECT', refType: 'IQC_DEFECT_RECEIVE', remark: 'r',
    }));
  });

  it('이미 취소된 입고는 다시 취소할 수 없다', async () => {
    stockTxRepo.findOne
      .mockResolvedValueOnce({ transNo: 'STX-1', matUid: 'S-1', itemCode: 'ITEM', qty: 5, fromWarehouseId: 'W001', toWarehouseId: 'DEFECT', company: 'C1', plant: 'P1' } as StockTransaction)
      .mockResolvedValueOnce({ transNo: 'STX-2', cancelRefId: 'STX-1' } as StockTransaction);
    await expect(target.cancel({ transNo: 'STX-1' }, 'C1', 'P1')).rejects.toThrow('이미 취소된');
  });
});
