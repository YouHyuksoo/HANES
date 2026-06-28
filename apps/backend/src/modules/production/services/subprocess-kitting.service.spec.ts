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
});
