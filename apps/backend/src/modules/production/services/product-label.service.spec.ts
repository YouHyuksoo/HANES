import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { ProductLabelService } from './product-label.service';

describe('ProductLabelService', () => {
  let service: ProductLabelService;
  let prodResultRepo: DeepMocked<Repository<ProdResult>>;
  let partRepo: DeepMocked<Repository<PartMaster>>;
  let dataSource: DeepMocked<DataSource>;
  let numbering: DeepMocked<NumberingService>;

  beforeEach(async () => {
    prodResultRepo = createMock<Repository<ProdResult>>();
    partRepo = createMock<Repository<PartMaster>>();
    dataSource = createMock<DataSource>();
    numbering = createMock<NumberingService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductLabelService,
        { provide: getRepositoryToken(ProdResult), useValue: prodResultRepo },
        { provide: getRepositoryToken(PartMaster), useValue: partRepo },
        { provide: getRepositoryToken(LabelPrintLog), useValue: createMock<Repository<LabelPrintLog>>() },
        { provide: DataSource, useValue: dataSource },
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
      service.createPrdLabels({ sourceId: 1, source: 'PROD_RESULT' as any, qty: 1 }, 'C1', 'P1'),
    ).rejects.toThrow(NotFoundException);

    expect(prodResultRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resultNo: '1', company: 'C1', plant: 'P1' }),
      }),
    );
  });
});
