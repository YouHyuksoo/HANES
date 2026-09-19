import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EquipMaterialService } from './equip-material.service';
import { WipMatStock } from '../../../entities/wip-mat-stock.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { ProcMatStockService } from '../../inventory/services/proc-mat-stock.service';
import { TransactionService } from '../../../shared/transaction.service';
import { CarrierFlowService } from './carrier-flow.service';

describe('EquipMaterialService.mount — 대차 해제', () => {
  it('장착 성공 시 MAT_LOTS 대차 컬럼을 비운다', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce({ equipCode: 'EQ1', processCode: 'P10' }).mockResolvedValueOnce(null),
      find: jest.fn().mockResolvedValue([]),
    };
    const tx = { run: jest.fn(async (cb: (qr: unknown) => Promise<unknown>) => cb({ manager })) };
    const carrierFlow = { clearInTx: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        EquipMaterialService,
        { provide: getRepositoryToken(WipMatStock), useValue: { manager } },
        { provide: getRepositoryToken(ItemMaster), useValue: { findOne: jest.fn().mockResolvedValue(null) } },
        { provide: WipMatStockService, useValue: { addStockInTx: jest.fn() } },
        { provide: ProcMatStockService, useValue: { findLot: jest.fn().mockResolvedValue({ itemCode: 'RM-1', availableQty: 100 }), deductStockInTx: jest.fn() } },
        { provide: TransactionService, useValue: tx },
        { provide: CarrierFlowService, useValue: carrierFlow },
      ],
    }).compile();
    const svc = module.get(EquipMaterialService);
    await svc.mount('EQ1', 'VH1-RM1', '40', '1000', 'W1');
    expect(carrierFlow.clearInTx).toHaveBeenCalledWith(expect.anything(), 'MAT', ['VH1-RM1'], '40', '1000');
  });
});
