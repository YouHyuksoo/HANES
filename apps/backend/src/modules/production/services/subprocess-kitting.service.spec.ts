import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { LessThanOrEqual, MoreThanOrEqual, QueryRunner, Repository } from 'typeorm';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { BomMaster } from '../../../entities/bom-master.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProductGenealogy } from '../../../entities/product-genealogy.entity';
import { SgLabel } from '../../../entities/sg-label.entity';
import { ProductInventoryService } from '../../inventory/services/product-inventory.service';
import { WipMatStockService } from '../../inventory/services/wip-mat-stock.service';
import { AutoIssueService } from './auto-issue.service';
import { ProductionSpecificationService } from './production-specification.service';
import { ProdResultService } from './prod-result.service';
import { SubprocessKittingService } from './subprocess-kitting.service';

describe('SubprocessKittingService BOM effective date', () => {
  let service: SubprocessKittingService;
  let tx: DeepMocked<TransactionService>;
  let qr: DeepMocked<QueryRunner>;
  const bomEffectiveDate = new Date(2026, 3, 15);

  beforeEach(async () => {
    tx = createMock<TransactionService>();
    qr = createMock<QueryRunner>();
    tx.run.mockImplementation(async (callback) => callback(qr));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubprocessKittingService,
        { provide: getRepositoryToken(SgLabel), useValue: createMock<Repository<SgLabel>>() },
        { provide: getRepositoryToken(JobOrder), useValue: createMock<Repository<JobOrder>>() },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: getRepositoryToken(BomMaster), useValue: createMock<Repository<BomMaster>>() },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: WipMatStockService, useValue: createMock<WipMatStockService>() },
        { provide: AutoIssueService, useValue: createMock<AutoIssueService>() },
        { provide: ProductionSpecificationService, useValue: createMock<ProductionSpecificationService>() },
        { provide: ProdResultService, useValue: createMock<ProdResultService>() },
      ],
    }).compile();

    service = module.get(SubprocessKittingService);
  });

  it('조립 확정에서 작업지시 계획일이 없으면 BOM 조회 전에 거부한다', async () => {
    qr.manager.findOne
      .mockResolvedValueOnce({ fgBarcode: 'FG-001', status: 'ISSUED', orderNo: 'JO-001' } as FgLabel)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        status: 'READY',
        part: { itemType: 'FINISHED' },
      } as JobOrder);

    await expect(
      service.confirmAssembly(
        {
          fgBarcode: 'FG-001',
          orderNo: 'JO-001',
          equipCode: 'EQ-1',
          processCode: 'CONAS',
          sgBarcodes: ['SG-001'],
        },
        'C1',
        'P1',
      ),
    ).rejects.toThrow('작업지시 계획일이 없어 BOM 기준일을 결정할 수 없습니다');
    expect(qr.manager.find).not.toHaveBeenCalledWith(BomMaster, expect.anything());
  });

  it('조립 확정 BOM은 작업지시 계획일에 유효한 행만 조회한다', async () => {
    qr.manager.findOne
      .mockResolvedValueOnce({ fgBarcode: 'FG-001', status: 'ISSUED', orderNo: 'JO-001' } as FgLabel)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        orderNo: 'JO-001',
        itemCode: 'FG-001',
        status: 'READY',
        planDate: bomEffectiveDate,
        part: { itemType: 'FINISHED' },
      } as JobOrder);
    qr.manager.find.mockResolvedValueOnce([]);

    await expect(
      service.confirmAssembly(
        {
          fgBarcode: 'FG-001',
          orderNo: 'JO-001',
          equipCode: 'EQ-1',
          processCode: 'CONAS',
          sgBarcodes: ['SG-001'],
        },
        'C1',
        'P1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(qr.manager.find).toHaveBeenCalledWith(BomMaster, {
      where: {
        parentItemCode: 'FG-001',
        useYn: 'Y',
        validFrom: LessThanOrEqual(bomEffectiveDate),
        validTo: MoreThanOrEqual(bomEffectiveDate),
        company: 'C1',
        plant: 'P1',
      },
    });
  });

  it('ROUTING_MATERIALS가 비면 원자재 차감 맵을 비운다', async () => {
    qr.manager.find.mockResolvedValueOnce([]);
    const map = new Map<string, number>([['RM-001', 2]]);

    await (service as any).filterRawByRoutingMaterials(
      qr,
      'RT-1',
      'PROC-1',
      { company: 'C1', plant: 'P1' },
      map,
    );

    expect(map.size).toBe(0);
  });

  it('공정 배정 투입수량(ALLOC_QTY)이 있으면 BOM 소요량 대신 그 값으로 차감한다', async () => {
    // 터미널 BOM 2개를 두 공정이 1개씩 나눠 소비하는 라우팅 — 현재 공정(seq 10)은 1개만
    qr.manager.find.mockResolvedValueOnce([
      { routingCode: 'RT-1', seq: 10, childItemCode: 'TERM-001', allocQty: 1, useYn: 'Y' },
      { routingCode: 'RT-1', seq: 20, childItemCode: 'TERM-001', allocQty: 1, useYn: 'Y' },
      { routingCode: 'RT-1', seq: 10, childItemCode: 'WIRE-001', allocQty: 0, useYn: 'Y' },
    ]);
    qr.manager.findOne.mockResolvedValueOnce({ routingCode: 'RT-1', processCode: 'PROC-1', seq: 10 });
    const map = new Map<string, number>([['TERM-001', 2], ['WIRE-001', 3], ['OTHER-001', 5]]);

    await (service as any).filterRawByRoutingMaterials(
      qr,
      'RT-1',
      'PROC-1',
      { company: 'C1', plant: 'P1' },
      map,
    );

    expect(map.get('TERM-001')).toBe(1);   // ALLOC_QTY 우선
    expect(map.get('WIRE-001')).toBe(3);   // ALLOC_QTY 0 → BOM 유지
    expect(map.has('OTHER-001')).toBe(false); // 이 공정 미배정 → 제외
  });
});

describe('SubprocessKittingService 설비점검 인터록 게이트', () => {
  let service: SubprocessKittingService;
  let tx: DeepMocked<TransactionService>;
  let prodResultService: DeepMocked<ProdResultService>;

  beforeEach(async () => {
    tx = createMock<TransactionService>();
    prodResultService = createMock<ProdResultService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubprocessKittingService,
        { provide: getRepositoryToken(SgLabel), useValue: createMock<Repository<SgLabel>>() },
        { provide: getRepositoryToken(JobOrder), useValue: createMock<Repository<JobOrder>>() },
        { provide: getRepositoryToken(ItemMaster), useValue: createMock<Repository<ItemMaster>>() },
        { provide: getRepositoryToken(BomMaster), useValue: createMock<Repository<BomMaster>>() },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: createMock<NumberingService>() },
        { provide: ProductInventoryService, useValue: createMock<ProductInventoryService>() },
        { provide: WipMatStockService, useValue: createMock<WipMatStockService>() },
        { provide: AutoIssueService, useValue: createMock<AutoIssueService>() },
        { provide: ProductionSpecificationService, useValue: createMock<ProductionSpecificationService>() },
        { provide: ProdResultService, useValue: prodResultService },
      ],
    }).compile();

    service = module.get(SubprocessKittingService);
  });

  it('조립 확정은 설비점검 게이트가 거부하면 트랜잭션에 들어가지 않는다', async () => {
    prodResultService.assertEquipInspectGate.mockRejectedValueOnce(
      new BadRequestException('설비 일상점검을 완료해야 실적을 등록할 수 있습니다: EQ-1'),
    );

    await expect(
      service.confirmAssembly(
        { fgBarcode: 'FG-001', orderNo: 'JO-001', equipCode: 'EQ-1', processCode: 'CONAS', sgBarcodes: ['SG-001'] },
        'C1',
        'P1',
      ),
    ).rejects.toThrow('설비 일상점검을 완료해야');
    expect(prodResultService.assertEquipInspectGate).toHaveBeenCalledWith(
      { equipCode: 'EQ-1', orderNo: 'JO-001' },
      'C1',
      'P1',
    );
    expect(tx.run).not.toHaveBeenCalled();
  });

  it('서브 키팅 확정은 설비점검 게이트가 거부하면 트랜잭션에 들어가지 않는다', async () => {
    prodResultService.assertEquipInspectGate.mockRejectedValueOnce(
      new BadRequestException('작업자 설비점검을 완료해야 실적을 등록할 수 있습니다: EQ-2 (작업지시 JO-002)'),
    );

    await expect(
      service.confirmSubKit(
        { newSgBarcode: 'SG-NEW', orderNo: 'JO-002', equipCode: 'EQ-2', processCode: 'SUBK', inputSgBarcodes: ['SG-001'] },
        'C1',
        'P1',
      ),
    ).rejects.toThrow('작업자 설비점검을 완료해야');
    expect(prodResultService.assertEquipInspectGate).toHaveBeenCalledWith(
      { equipCode: 'EQ-2', orderNo: 'JO-002' },
      'C1',
      'P1',
    );
    expect(tx.run).not.toHaveBeenCalled();
  });

  it('게이트가 통과하면 조립 확정은 트랜잭션으로 진행한다', async () => {
    prodResultService.assertEquipInspectGate.mockResolvedValueOnce(undefined);
    tx.run.mockResolvedValueOnce({ resultNo: 'R1', fgBarcode: 'FG-001', printFg: false, sgLabels: [] });

    await service.confirmAssembly(
      { fgBarcode: 'FG-001', orderNo: 'JO-001', equipCode: 'EQ-1', processCode: 'CONAS', sgBarcodes: ['SG-001'] },
      'C1',
      'P1',
    );
    expect(tx.run).toHaveBeenCalledTimes(1);
  });
});
