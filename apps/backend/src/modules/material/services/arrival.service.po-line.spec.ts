/**
 * @file arrival.service.po-line.spec.ts
 * @description IQC005 Phase A — ArrivalService.receivePoLine 단위 테스트
 *
 * 5 시나리오:
 * 1. receivedQty 200, LOT_UNIT_QTY 50 → MAT_LOT 4건 (각 50)
 * 2. receivedQty 220, LOT_UNIT_QTY 50 → MAT_LOT 5건 (50,50,50,50,20)
 * 3. LOT_UNIT_QTY NULL → 단일 MAT_LOT 1건
 * 4. receivedQty > 잔량 → BadRequestException
 * 5. mfgPartnerCode가 PARTNER_TYPE='MFG' 아님 → BadRequestException
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, QueryRunner, EntityManager, Repository } from 'typeorm';
import { ArrivalService } from './arrival.service';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { MockLoggerService } from '@test/mock-logger.service';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { MatArrivalTransaction } from '../../../entities/mat-arrival-transaction.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { VendorBarcodeMapping } from '../../../entities/vendor-barcode-mapping.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';

describe('ArrivalService.receivePoLine (IQC005 Phase A)', () => {
  let target: ArrivalService;
  let mockManager: DeepMocked<EntityManager>;
  let mockQueryRunner: DeepMocked<QueryRunner>;
  let mockNumbering: DeepMocked<NumberingService>;
  let mockTx: DeepMocked<TransactionService>;

  const user = { username: 'tester', company: '40', plant: '1000' };

  beforeEach(async () => {
    mockManager = createMock<EntityManager>();
    mockQueryRunner = createMock<QueryRunner>();
    mockNumbering = createMock<NumberingService>();
    mockTx = createMock<TransactionService>();

    // qr.manager → mockManager
    Object.defineProperty(mockQueryRunner, 'manager', { value: mockManager, writable: false });

    // tx.run callback에 mockQueryRunner 전달
    mockTx.run.mockImplementation(async (callback: any) => callback(mockQueryRunner));

    // create / save 기본 동작
    mockManager.create.mockImplementation(((_cls: any, data: any) => ({ ...data })) as any);
    mockManager.save.mockImplementation((async (_clsOrEntity: any, maybeData?: any) => {
      const data = maybeData ?? _clsOrEntity;
      return data;
    }) as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArrivalService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: createMock<Repository<PurchaseOrder>>() },
        { provide: getRepositoryToken(PurchaseOrderItem), useValue: createMock<Repository<PurchaseOrderItem>>() },
        { provide: getRepositoryToken(MatLot), useValue: createMock<Repository<MatLot>>() },
        { provide: getRepositoryToken(MatStock), useValue: createMock<Repository<MatStock>>() },
        { provide: getRepositoryToken(MatArrival), useValue: createMock<Repository<MatArrival>>() },
        { provide: getRepositoryToken(MatArrivalStock), useValue: createMock<Repository<MatArrivalStock>>() },
        { provide: getRepositoryToken(MatArrivalTransaction), useValue: createMock<Repository<MatArrivalTransaction>>() },
        { provide: getRepositoryToken(StockTransaction), useValue: createMock<Repository<StockTransaction>>() },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: getRepositoryToken(Warehouse), useValue: createMock<Repository<Warehouse>>() },
        { provide: getRepositoryToken(VendorBarcodeMapping), useValue: createMock<Repository<VendorBarcodeMapping>>() },
        { provide: getRepositoryToken(IqcLog), useValue: createMock<Repository<IqcLog>>() },
        { provide: getRepositoryToken(PartnerMaster), useValue: createMock<Repository<PartnerMaster>>() },
        { provide: DataSource, useValue: { manager: mockManager, createQueryRunner: () => mockQueryRunner } },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: TransactionService, useValue: mockTx },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<ArrivalService>(ArrivalService);
  });

  afterEach(() => jest.clearAllMocks());

  /** 시나리오별 공통 mock 셋업 */
  const setupFindOne = (cfg: {
    lotUnitQty: number | null;
    orderQty: number;
    receivedQty: number;
    mfgFound: boolean;
  }) => {
    mockManager.findOne.mockImplementation(((entity: any) => {
      if (entity === PurchaseOrderItem) {
        return Promise.resolve({
          poNo: 'PO-26-001',
          seq: 1,
          itemCode: 'TMN-0001',
          orderQty: cfg.orderQty,
          receivedQty: cfg.receivedQty,
          lineNo: 1,
          revNo: 1,
          lineStatus: 'PARTIAL',
        });
      }
      if (entity === PurchaseOrder) {
        return Promise.resolve({
          poNo: 'PO-26-001',
          partnerCode: 'VND-001',
          partnerName: '한국단자공업',
          useType: 'PROD',
          status: 'CONFIRMED',
        });
      }
      if (entity === PartnerMaster) {
        return Promise.resolve(cfg.mfgFound ? { partnerCode: 'M001', partnerType: 'MFG' } : null);
      }
      if (entity === ItemMaster) {
        return Promise.resolve({ itemCode: 'TMN-0001', lotUnitQty: cfg.lotUnitQty });
      }
      if (entity === Warehouse) {
        return Promise.resolve({ warehouseCode: 'W01', warehouseType: 'RAW' });
      }
      return Promise.resolve(null);
    }) as any);
  };

  const baseDto = {
    poNo: 'PO-26-001',
    lineNo: 1,
    revNo: 1,
    mfgPartnerCode: 'M001',
    receivedDate: '2026-05-26',
    warehouseCode: 'W01',
  };

  it('case 1: receivedQty 200 / LOT_UNIT_QTY 50 → 시리얼 4건 (각 50)', async () => {
    setupFindOne({ lotUnitQty: 50, orderQty: 1000, receivedQty: 300, mfgFound: true });
    mockNumbering.nextArrivalNoV2.mockResolvedValue('R26052600001');
    mockNumbering.nextMatSerial
      .mockResolvedValueOnce('VH1-RM260526-00001')
      .mockResolvedValueOnce('VH1-RM260526-00002')
      .mockResolvedValueOnce('VH1-RM260526-00003')
      .mockResolvedValueOnce('VH1-RM260526-00004');
    mockNumbering.next.mockResolvedValue('STX0000001');

    const result = await target.receivePoLine({ ...baseDto, receivedQty: 200 }, user);

    expect(result.arrivalNo).toBe('R26052600001');
    expect(result.serials).toHaveLength(4);
    expect(result.serials.map((s) => s.initQty)).toEqual([50, 50, 50, 50]);
    expect(result.serials.map((s) => s.matUid)).toEqual([
      'VH1-RM260526-00001',
      'VH1-RM260526-00002',
      'VH1-RM260526-00003',
      'VH1-RM260526-00004',
    ]);
    expect(result.serials.every((s) => s.mfgPartnerCode === 'M001')).toBe(true);
    expect(result.serials.every((s) => s.arrivalNo === 'R26052600001')).toBe(true);
  });

  it('case 2: receivedQty 220 / LOT_UNIT_QTY 50 → 시리얼 5건 (50,50,50,50,20)', async () => {
    setupFindOne({ lotUnitQty: 50, orderQty: 1000, receivedQty: 0, mfgFound: true });
    mockNumbering.nextArrivalNoV2.mockResolvedValue('R26052600002');
    let counter = 100;
    mockNumbering.nextMatSerial.mockImplementation(() =>
      Promise.resolve(`VH1-RM260526-${String(++counter).padStart(5, '0')}`),
    );
    mockNumbering.next.mockResolvedValue('STX0000002');

    const result = await target.receivePoLine({ ...baseDto, receivedQty: 220 }, user);

    expect(result.serials).toHaveLength(5);
    expect(result.serials.map((s) => s.initQty)).toEqual([50, 50, 50, 50, 20]);
  });

  it('case 3: LOT_UNIT_QTY NULL → 단일 LOT 1건 (receivedQty 그대로)', async () => {
    setupFindOne({ lotUnitQty: null, orderQty: 1000, receivedQty: 0, mfgFound: true });
    mockNumbering.nextArrivalNoV2.mockResolvedValue('R26052600003');
    mockNumbering.nextMatSerial.mockResolvedValueOnce('VH1-RM260526-00200');
    mockNumbering.next.mockResolvedValue('STX0000003');

    const result = await target.receivePoLine({ ...baseDto, receivedQty: 200 }, user);

    expect(result.serials).toHaveLength(1);
    expect(result.serials[0].initQty).toBe(200);
  });

  it('case 4: receivedQty가 잔량 초과 → BadRequestException', async () => {
    setupFindOne({ lotUnitQty: 50, orderQty: 100, receivedQty: 50, mfgFound: true });

    await expect(
      target.receivePoLine({ ...baseDto, receivedQty: 200 }, user),
    ).rejects.toThrow(BadRequestException);
  });

  it('case 5: mfgPartnerCode가 MFG 타입 아님 → BadRequestException', async () => {
    setupFindOne({ lotUnitQty: 50, orderQty: 1000, receivedQty: 0, mfgFound: false });

    await expect(
      target.receivePoLine({ ...baseDto, receivedQty: 100, mfgPartnerCode: 'X999' }, user),
    ).rejects.toThrow(BadRequestException);
  });
});
