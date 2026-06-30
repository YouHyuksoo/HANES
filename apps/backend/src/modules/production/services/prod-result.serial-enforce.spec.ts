import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProdResultService } from './prod-result.service';
import { ProdResult } from '../../../entities/prod-result.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { EquipBomRel } from '../../../entities/equip-bom-rel.entity';
import { EquipBomItem } from '../../../entities/equip-bom-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ConsumableMaster } from '../../../entities/consumable-master.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { User } from '../../../entities/user.entity';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { ShiftPattern } from '../../../entities/shift-pattern.entity';
import { AutoIssueService } from './auto-issue.service';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { NumberingService } from '../../../shared/numbering.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';

/**
 * 키오스크 prdUid 누락 방어(시리얼 강제 채번)와 취소 시 빈 PRODUCT_STOCKS 행 정리 로직 단위 검증.
 * complete()/cancel() 전체 오케스트레이션 대신 신규 핵심 로직만 직접 호출해 검증한다.
 */
describe('ProdResultService serial enforce & empty-stock cleanup', () => {
  let target: ProdResultService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdResultService,
        { provide: getRepositoryToken(ProdResult), useValue: createMock<Repository<ProdResult>>() },
        { provide: getRepositoryToken(JobOrder), useValue: createMock<Repository<JobOrder>>() },
        { provide: getRepositoryToken(EquipMaster), useValue: createMock<Repository<EquipMaster>>() },
        { provide: getRepositoryToken(EquipBomRel), useValue: createMock<Repository<EquipBomRel>>() },
        { provide: getRepositoryToken(EquipBomItem), useValue: createMock<Repository<EquipBomItem>>() },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: getRepositoryToken(ConsumableMaster), useValue: createMock<Repository<ConsumableMaster>>() },
        { provide: getRepositoryToken(MatIssue), useValue: createMock<Repository<MatIssue>>() },
        { provide: getRepositoryToken(User), useValue: createMock<Repository<User>>() },
        { provide: getRepositoryToken(WorkerMaster), useValue: createMock<Repository<WorkerMaster>>() },
        { provide: getRepositoryToken(ShiftPattern), useValue: createMock<Repository<ShiftPattern>>() },
        { provide: DataSource, useValue: createMock<DataSource>() },
        { provide: AutoIssueService, useValue: createMock<AutoIssueService>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: WipMatStockService, useValue: createMock<WipMatStockService>() },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: SysConfigService, useValue: createMock<SysConfigService>() },
        { provide: TransactionService, useValue: createMock<TransactionService>() },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ProdResultService>(ProdResultService);
  });

  describe('generateProductSerial', () => {
    it('starts at -001 when the order has no existing serials', async () => {
      const manager = { find: jest.fn().mockResolvedValue([]) };
      const qr = { manager } as any;

      const serial = await (target as any).generateProductSerial(qr, 'WO-100', 'C1', 'P1');

      expect(serial).toBe('WO-100-001');
      expect(manager.find).toHaveBeenCalledWith(
        ProdResult,
        expect.objectContaining({
          where: expect.objectContaining({ orderNo: 'WO-100', company: 'C1', plant: 'P1' }),
        }),
      );
    });

    it('continues from the max existing sequence (max 002 -> 003)', async () => {
      const manager = {
        find: jest.fn().mockResolvedValue([
          { prdUid: 'WO-100-001' },
          { prdUid: 'WO-100-002' },
          { prdUid: null },
        ]),
      };
      const qr = { manager } as any;

      const serial = await (target as any).generateProductSerial(qr, 'WO-100', 'C1', 'P1');

      expect(serial).toBe('WO-100-003');
    });
  });

  describe('reverseProductStock empty-row cleanup', () => {
    function buildQr(stockQty: number, reservedQty: number) {
      const manager = {
        find: jest.fn().mockResolvedValue([
          {
            transNo: 'PTX-1',
            toWarehouseId: 'SFG_WIP',
            itemCode: 'ITEM-1',
            itemType: 'SEMI_PRODUCT',
            prdUid: '*',
            qty: 100,
            company: 'C1',
            plant: 'P1',
          },
        ]),
        findOne: jest.fn().mockResolvedValue({
          warehouseCode: 'SFG_WIP',
          itemCode: 'ITEM-1',
          prdUid: '*',
          qty: stockQty,
          reservedQty,
          company: 'C1',
          plant: 'P1',
        }),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        create: jest.fn((_e, p) => ({ ...p })),
        save: jest.fn().mockResolvedValue(undefined),
      };
      return { qr: { manager } as any, manager };
    }

    it('deletes the stock row when cancel drives qty to 0 with no reservation', async () => {
      const { qr, manager } = buildQr(100, 0);

      await (target as any).reverseProductStock(qr, 'PR-1', 'C1', 'P1');

      // PRD_UID 비키화(78d46411): 재고 키는 품목+창고 기준, prdUid는 키에서 제외
      expect(manager.delete).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ warehouseCode: 'SFG_WIP', itemCode: 'ITEM-1' }),
      );
      // 빈 행은 update가 아니라 delete 되어야 한다
      expect(manager.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ warehouseCode: 'SFG_WIP', itemCode: 'ITEM-1' }),
        expect.objectContaining({ qty: 0 }),
      );
    });

    it('updates (not deletes) the stock row when residual qty remains', async () => {
      const { qr, manager } = buildQr(150, 0);

      await (target as any).reverseProductStock(qr, 'PR-1', 'C1', 'P1');

      expect(manager.delete).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ warehouseCode: 'SFG_WIP', itemCode: 'ITEM-1' }),
        expect.objectContaining({ qty: 50 }),
      );
    });

    it('keeps the row (update) when qty is 0 but a reservation exists', async () => {
      const { qr, manager } = buildQr(100, 10);

      await (target as any).reverseProductStock(qr, 'PR-1', 'C1', 'P1');

      expect(manager.delete).not.toHaveBeenCalled();
    });
  });

  describe('adsorbProductStockInTx (즉시 적재 + 멱등)', () => {
    function buildAdsorbQr(opts: { existingTx?: unknown; prdUid?: string | null }) {
      const manager = {
        findOne: jest.fn().mockImplementation(async (entity: any) => {
          switch (entity?.name) {
            case 'ProductTransaction':
              return opts.existingTx ?? null;
            case 'JobOrder':
              return { itemCode: 'ITEM-1', part: { itemType: 'SEMI_PRODUCT' }, company: 'C1', plant: 'P1' };
            case 'ProdResult':
              return { resultNo: 'PR-1', prdUid: opts.prdUid ?? null };
            default:
              return null;
          }
        }),
        find: jest.fn().mockResolvedValue([]), // generateProductSerial 조회
        update: jest.fn().mockResolvedValue(undefined),
      };
      return { qr: { manager } as any, manager };
    }

    it('skips re-adsorption when the result already has a WIP_IN transaction (idempotent)', async () => {
      const { qr } = buildAdsorbQr({ existingTx: { transNo: 'PTX-1' } });
      const prodInv = (target as any).productInventoryService;

      await (target as any).adsorbProductStockInTx(qr, {
        resultNo: 'PR-1', orderNo: 'WO-1', goodQty: 5, processCode: 'P1', company: 'C1', plant: 'P1',
      });

      expect(prodInv.receiveStockInTx).not.toHaveBeenCalled();
    });

    it('adsorbs WIP_IN with a generated serial when prdUid is empty', async () => {
      const { qr, manager } = buildAdsorbQr({ existingTx: null, prdUid: null });
      const prodInv = (target as any).productInventoryService;

      await (target as any).adsorbProductStockInTx(qr, {
        resultNo: 'PR-1', orderNo: 'WO-1', goodQty: 5, processCode: 'P1', company: 'C1', plant: 'P1',
      });

      // 시리얼 강제 채번값으로 실적 update + WIP_IN 적재
      expect(manager.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ resultNo: 'PR-1' }),
        expect.objectContaining({ prdUid: 'WO-1-001' }),
      );
      // PRD_UID 비키화(78d46411): 시리얼은 ProdResult에만 stamp, 재고 적재 payload에는 prdUid 미포함
      expect(prodInv.receiveStockInTx).toHaveBeenCalledWith(
        qr,
        expect.objectContaining({
          warehouseId: 'SFG_WIP', itemCode: 'ITEM-1', itemType: 'SEMI_PRODUCT',
          qty: 5, transType: 'WIP_IN', refType: 'PROD_RESULT', refId: 'PR-1',
        }),
      );
    });

    it('does nothing when goodQty is 0', async () => {
      const { qr, manager } = buildAdsorbQr({ existingTx: null });
      const prodInv = (target as any).productInventoryService;

      await (target as any).adsorbProductStockInTx(qr, {
        resultNo: 'PR-1', orderNo: 'WO-1', goodQty: 0, company: 'C1', plant: 'P1',
      });

      expect(manager.findOne).not.toHaveBeenCalled();
      expect(prodInv.receiveStockInTx).not.toHaveBeenCalled();
    });
  });
});
