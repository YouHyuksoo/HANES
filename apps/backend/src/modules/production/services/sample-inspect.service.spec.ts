import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { MockLoggerService } from '../../../common/test/mock-logger.service';
import { JobOrder } from '../../../entities/job-order.entity';
import { SampleInspectResult } from '../../../entities/sample-inspect-result.entity';
import { SampleInspectService } from './sample-inspect.service';

describe('SampleInspectService', () => {
  let service: SampleInspectService;
  let sampleInspectRepo: DeepMocked<Repository<SampleInspectResult>>;
  let jobOrderRepo: DeepMocked<Repository<JobOrder>>;
  let dataSource: DeepMocked<DataSource>;
  let queryRunner: DeepMocked<QueryRunner>;

  beforeEach(async () => {
    sampleInspectRepo = createMock<Repository<SampleInspectResult>>();
    jobOrderRepo = createMock<Repository<JobOrder>>();
    dataSource = createMock<DataSource>();
    queryRunner = createMock<QueryRunner>();

    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    queryRunner.connect.mockResolvedValue(undefined);
    queryRunner.startTransaction.mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockResolvedValue(undefined);
    queryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SampleInspectService,
        { provide: getRepositoryToken(SampleInspectResult), useValue: sampleInspectRepo },
        { provide: getRepositoryToken(JobOrder), useValue: jobOrderRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    service = module.get<SampleInspectService>(SampleInspectService);
  });

  it('creates sample records using tenant-scoped job order lookup', async () => {
    const dto = {
      orderNo: 'JO-001',
      inspectDate: '2026-03-18',
      inspectorName: 'INSPECTOR',
      inspectType: 'DIMENSION',
      samples: [{ sampleNo: 1, passYn: 'Y' }],
    } as any;

    jobOrderRepo.findOne.mockResolvedValue({ orderNo: 'JO-001', company: 'C1', plant: 'P1' } as any);
    queryRunner.manager.create.mockImplementation((_: any, data: any) => data);
    queryRunner.manager.save.mockResolvedValue([{ id: 1 }] as any);

    const result = await service.create(dto, 'C1', 'P1');

    expect(result.count).toBe(1);
    expect(jobOrderRepo.findOne).toHaveBeenCalledWith({
      where: { orderNo: 'JO-001', company: 'C1', plant: 'P1' },
    });
  });

  it('throws when job order is not found', async () => {
    jobOrderRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create(
        {
          orderNo: 'JO-404',
          inspectDate: '2026-03-18',
          inspectorName: 'I',
          samples: [{ sampleNo: 1, passYn: 'Y' }],
        } as any,
        'C1',
        'P1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('passes tenant scope to findByJobOrder', async () => {
    sampleInspectRepo.find.mockResolvedValue([] as SampleInspectResult[]);

    await service.findByJobOrder('JO-001', 'C1', 'P1');

    expect(sampleInspectRepo.find).toHaveBeenCalledWith({
      where: { orderNo: 'JO-001', company: 'C1', plant: 'P1' },
      order: { inspectDate: 'DESC', sampleNo: 'ASC' },
    });
  });
});
