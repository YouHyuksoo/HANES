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

  it('reports the other equipment name when the LOT has moved out of process stock', async () => {
    manager.findOne = jest.fn().mockResolvedValue({ equipCode: 'EQ-A', processCode: 'ASSY' });
    procMatStockService.findLot.mockResolvedValue(null);
    manager.find = jest.fn()
      .mockResolvedValueOnce([{ equipCode: 'EQ-B', qty: 6, availableQty: 0, reservedQty: 6 }])
      .mockResolvedValueOnce([{ equipCode: 'EQ-B', equipName: '조립 2호기' }]);

    await expect(target.mount('EQ-A', 'MAT-001', '40', '1000'))
      .rejects.toThrow('다른 설비(조립 2호기 (EQ-B))에 장착중입니다. 해제 후 장착하세요.');
    expect(manager.find).toHaveBeenCalledWith(WipMatStock, expect.objectContaining({
      where: expect.objectContaining({ company: '40', plant: '1000', matUid: 'MAT-001' }),
    }));
    expect(manager.find).toHaveBeenCalledWith(EquipMaster, expect.objectContaining({
      where: expect.objectContaining({ company: '40', plant: '1000' }),
    }));
    expect(procMatStockService.deductStockInTx).not.toHaveBeenCalled();
  });

  it('keeps the issue-first message when no equipment has the LOT', async () => {
    manager.findOne = jest.fn().mockResolvedValue({ equipCode: 'EQ-A', processCode: 'ASSY' });
    procMatStockService.findLot.mockResolvedValue(null);
    manager.find = jest.fn().mockResolvedValue([]);
    await expect(target.mount('EQ-A', 'MAT-001', '40', '1000'))
      .rejects.toThrow('자재 출고(공정 입고)가 먼저 필요합니다.');
    expect(procMatStockService.deductStockInTx).not.toHaveBeenCalled();
  });

  it('reports duplicate mounting on this equipment even when process stock is empty', async () => {
    manager.findOne = jest.fn().mockResolvedValue({ equipCode: 'EQ-A', processCode: 'ASSY' });
    procMatStockService.findLot.mockResolvedValue(null);
    manager.find = jest.fn().mockResolvedValue([{ equipCode: 'EQ-A', qty: 2 }]);
    await expect(target.mount('EQ-A', 'MAT-001', '40', '1000'))
      .rejects.toThrow('이미 해당 설비에 장착된 자재 LOT입니다');
  });

  it('mounts available process stock with the original stock transfer', async () => {
    manager.findOne = jest.fn()
      .mockResolvedValueOnce({ equipCode: 'EQ-A', processCode: 'ASSY' })
      .mockResolvedValueOnce(null);
    procMatStockService.findLot.mockResolvedValue({ itemCode: 'RAW-1', availableQty: 4 } as never);
    itemMasterRepo.findOne.mockResolvedValue(null);
    const row = await target.mount('EQ-A', 'MAT-001', '40', '1000');
    expect(row.qty).toBe(4);
    expect(procMatStockService.deductStockInTx).toHaveBeenCalledWith(qr, expect.objectContaining({ qty: 4 }));
    expect(wipMatStockService.addStockInTx).toHaveBeenCalledWith(qr, expect.objectContaining({ qty: 4 }));
  });

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
