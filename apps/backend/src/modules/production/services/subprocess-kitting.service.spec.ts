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
