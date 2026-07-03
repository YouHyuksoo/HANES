import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
import { TransactionService } from '../../../shared/transaction.service';
import { ProcMatStockService } from '../../inventory/services/proc-mat-stock.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { EquipMaterialService } from './equip-material.service';

describe('EquipMaterialService', () => {
  let target: EquipMaterialService;
  let wipStockRepo: DeepMocked<Repository<WipMatStock>>;
  let itemMasterRepo: DeepMocked<Repository<ItemMaster>>;
  let wipMatStockService: DeepMocked<WipMatStockService>;
  let procMatStockService: DeepMocked<ProcMatStockService>;
  let tx: DeepMocked<TransactionService>;
  let qr: QueryRunner;
  let manager: QueryRunner['manager'];

  beforeEach(async () => {
    wipStockRepo = createMock<Repository<WipMatStock>>();
    itemMasterRepo = createMock<Repository<ItemMaster>>();
    wipMatStockService = createMock<WipMatStockService>();
    procMatStockService = createMock<ProcMatStockService>();
    tx = createMock<TransactionService>();
    manager = createMock<QueryRunner['manager']>();
    qr = { manager } as QueryRunner;

    tx.run.mockImplementation(async (callback: (queryRunner: QueryRunner) => Promise<unknown>) => callback(qr));
    wipMatStockService.deductStockInTx.mockResolvedValue([{ matUid: 'MAT-001', qty: 3 }]);
    procMatStockService.addStockInTx.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipMaterialService,
        { provide: getRepositoryToken(WipMatStock), useValue: wipStockRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: itemMasterRepo },
        { provide: WipMatStockService, useValue: wipMatStockService },
        { provide: ProcMatStockService, useValue: procMatStockService },
        { provide: TransactionService, useValue: tx },
      ],
    }).setLogger(new MockLoggerService()).compile();

    target = module.get(EquipMaterialService);
  });

  afterEach(() => jest.clearAllMocks());

  it('unmount restores only the remaining mounted quantity back to process stock', async () => {
    manager.findOne = jest
      .fn()
      .mockResolvedValueOnce({
        company: '40',
        plant: '1000',
        equipCode: 'EQ-ATCNS-01',
        itemCode: '1SH21A7A09',
        matUid: 'MAT-001',
        qty: 3,
        availableQty: 3,
        reservedQty: 0,
      } as WipMatStock)
      .mockResolvedValueOnce({
        equipCode: 'EQ-ATCNS-01',
        processCode: 'ATCNS',
      } as EquipMaster);

    await target.unmount('EQ-ATCNS-01', 'MAT-001', '40', '1000');

    expect(wipMatStockService.deductStockInTx).toHaveBeenCalledWith(
      qr,
      expect.objectContaining({
        equipCode: 'EQ-ATCNS-01',
        itemCode: '1SH21A7A09',
        qty: 3,
        scannedMatUids: ['MAT-001'],
        transType: 'WIP_IN_CANCEL',
        refType: 'EQUIP_UNMOUNT',
        refId: 'MAT-001',
        stockPolicy: 'BLOCK',
        company: '40',
        plant: '1000',
      }),
    );
    expect(procMatStockService.addStockInTx).toHaveBeenCalledWith(
      qr,
      expect.objectContaining({
        processCode: 'ATCNS',
        itemCode: '1SH21A7A09',
        matUid: 'MAT-001',
        qty: 3,
        transType: 'PROC_UNMOUNT',
        refType: 'EQUIP_UNMOUNT',
        refId: 'MAT-001',
        equipCode: 'EQ-ATCNS-01',
        company: '40',
        plant: '1000',
      }),
    );
    expect(wipMatStockService.restoreInTx).not.toHaveBeenCalled();
    expect(procMatStockService.restoreInTx).not.toHaveBeenCalled();
  });

  it('unmount blocks when mounted stock is reserved', async () => {
    manager.findOne = jest.fn().mockResolvedValueOnce({
      company: '40',
      plant: '1000',
      equipCode: 'EQ-ATCNS-01',
      itemCode: '1SH21A7A09',
      matUid: 'MAT-001',
      qty: 3,
      availableQty: 0,
      reservedQty: 3,
    } as WipMatStock);

    await expect(target.unmount('EQ-ATCNS-01', 'MAT-001', '40', '1000')).rejects.toThrow(BadRequestException);
    expect(wipMatStockService.deductStockInTx).not.toHaveBeenCalled();
    expect(procMatStockService.addStockInTx).not.toHaveBeenCalled();
  });
});
