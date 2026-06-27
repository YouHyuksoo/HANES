import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { MockLoggerService } from '@test/mock-logger.service';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { FgLabel } from '../../../entities/fg-label.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { ProductLabelService } from './product-label.service';

describe('ProductLabelService', () => {
  let service: ProductLabelService;
  let prodResultRepo: DeepMocked<Repository<ProdResult>>;
  let partRepo: DeepMocked<Repository<ItemMaster>>;
  let dataSource: DeepMocked<DataSource>;
  let tx: DeepMocked<TransactionService>;
  let queryRunner: DeepMocked<QueryRunner>;
  let numbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    prodResultRepo = createMock<Repository<ProdResult>>();
    partRepo = createMock<Repository<ItemMaster>>();
    dataSource = createMock<DataSource>();
    tx = createMock<TransactionService>();
    queryRunner = createMock<QueryRunner>();
    numbering = createMock<NumberingService>();
    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    tx.run.mockImplementation(async (callback: any) => callback(queryRunner));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductLabelService,
        { provide: getRepositoryToken(ProdResult), useValue: prodResultRepo },
        { provide: getRepositoryToken(ItemMaster), useValue: partRepo },
        { provide: getRepositoryToken(FgLabel), useValue: createMock<Repository<FgLabel>>() },
        { provide: getRepositoryToken(LabelPrintLog), useValue: createMock<Repository<LabelPrintLog>>() },
        { provide: DataSource, useValue: dataSource },
        { provide: TransactionService, useValue: tx },
        { provide: NumberingService, useValue: numbering },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get<ProductLabelService>(ProductLabelService);
  });

  it('applies tenant scope in findLabelableResults', async () => {
    prodResultRepo.find.mockResolvedValue([] as ProdResult[]);

    await service.findLabelableResults('C1', 'P1');

    expect(prodResultRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ company: 'C1', plant: 'P1' }),
      }),
    );
  });

  it('applies tenant scope in findLabelableOqcPassed', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    prodResultRepo.createQueryBuilder.mockReturnValue(qb as any);

    await service.findLabelableOqcPassed('C1', 'P1');

    expect(qb.andWhere).toHaveBeenCalledWith('r.company = :company', { company: 'C1' });
    expect(qb.andWhere).toHaveBeenCalledWith('r.plant = :plant', { plant: 'P1' });
  });

  it('throws when createPrdLabels source result is not found in tenant scope', async () => {
    prodResultRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createPrdLabels({ sourceId: '1', source: 'PROD_RESULT' as any, qty: 1 }, 'C1', 'P1'),
    ).rejects.toThrow(NotFoundException);

    expect(prodResultRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resultNo: '1', company: 'C1', plant: 'P1' }),
      }),
    );
  });

  it('creates product labels through TransactionService', async () => {
    prodResultRepo.findOne.mockResolvedValue({
      resultNo: '1',
      prdUid: null,
      company: 'C1',
      plant: 'P1',
      jobOrder: { itemCode: 'FG-001' },
    } as ProdResult);
    partRepo.findOne.mockResolvedValue({ itemCode: 'FG-001', itemName: 'Finished Good' } as ItemMaster);
    numbering.nextPrdUid.mockResolvedValue('PRD-001');
    (queryRunner.manager.create as jest.Mock).mockImplementation((_entity, payload) => payload);
    (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(null);
    (queryRunner.manager.save as jest.Mock).mockResolvedValue({} as LabelPrintLog);
    queryRunner.manager.update.mockResolvedValue({ affected: 1 } as any);

    const result = await service.createPrdLabels({ sourceId: '1', source: 'PROD_RESULT' as any, qty: 1 }, 'C1', 'P1');

    expect(result).toEqual([{ prdUid: 'PRD-001', itemCode: 'FG-001', itemName: 'Finished Good' }]);
    expect(partRepo.findOne).toHaveBeenCalledWith({
      where: { itemCode: 'FG-001', company: 'C1', plant: 'P1' },
    });
    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      ProdResult,
      { resultNo: '1', company: 'C1', plant: 'P1' },
      { prdUid: 'PRD-001' },
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      FgLabel,
      expect.objectContaining({
        fgBarcode: 'PRD-001',
        itemCode: 'FG-001',
        orderNo: undefined,
        status: 'ISSUED',
        inspectPassYn: 'Y',
        company: 'C1',
        plant: 'P1',
      }),
    );
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      LabelPrintLog,
      expect.objectContaining({
        printedAt: expect.any(Date),
        category: 'prd_uid',
      }),
    );
  });

  it('uses string production result numbers and backfills missing FG_LABELS for an existing prdUid', async () => {
    prodResultRepo.findOne.mockResolvedValue({
      resultNo: 'PR26061200015',
      prdUid: 'PRD-EXISTING',
      orderNo: 'JO-1',
      workerId: 'worker1',
      equipCode: 'EQ1',
      company: 'C1',
      plant: 'P1',
      jobOrder: { itemCode: 'FG-001', lineCode: 'LINE-1' },
    } as ProdResult);
    partRepo.findOne.mockResolvedValue({ itemCode: 'FG-001', itemName: 'Finished Good' } as ItemMaster);
    (queryRunner.manager.create as jest.Mock).mockImplementation((_entity, payload) => payload);
    (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(null);

    const result = await service.createPrdLabels(
      { sourceId: 'PR26061200015', source: 'PROD_RESULT' as any, qty: 1 } as any,
      'C1',
      'P1',
    );

    expect(numbering.nextPrdUid).not.toHaveBeenCalled();
    expect(result).toEqual([{ prdUid: 'PRD-EXISTING', itemCode: 'FG-001', itemName: 'Finished Good' }]);
    expect(prodResultRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resultNo: 'PR26061200015', company: 'C1', plant: 'P1' }),
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      FgLabel,
      expect.objectContaining({
        fgBarcode: 'PRD-EXISTING',
        itemCode: 'FG-001',
        orderNo: 'JO-1',
        workerId: 'worker1',
        equipCode: 'EQ1',
        lineCode: 'LINE-1',
        status: 'ISSUED',
        inspectPassYn: 'Y',
      }),
    );
  });

  it('throws when source result tenant differs from request tenant', async () => {
    prodResultRepo.findOne.mockResolvedValue({
      resultNo: '1',
      prdUid: null,
      company: 'OTHER',
      plant: 'P1',
      jobOrder: { itemCode: 'FG-001' },
    } as ProdResult);

    await expect(
      service.createPrdLabels({ sourceId: '1', source: 'PROD_RESULT' as any, qty: 1 }, 'C1', 'P1'),
    ).rejects.toThrow(BadRequestException);

    expect(tx.run).not.toHaveBeenCalled();
  });
});
