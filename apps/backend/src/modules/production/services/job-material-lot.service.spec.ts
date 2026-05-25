import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { JobMaterialLotService } from './job-material-lot.service';
import { JobMaterialLot } from '../../../entities/job-material-lot.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('JobMaterialLotService', () => {
  let target: JobMaterialLotService;
  let repo: DeepMocked<Repository<JobMaterialLot>>;
  let matLotRepo: DeepMocked<Repository<MatLot>>;

  beforeEach(async () => {
    repo = createMock<Repository<JobMaterialLot>>();
    matLotRepo = createMock<Repository<MatLot>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobMaterialLotService,
        { provide: getRepositoryToken(JobMaterialLot), useValue: repo },
        { provide: getRepositoryToken(MatLot), useValue: matLotRepo },
      ],
    }).setLogger(new MockLoggerService()).compile();

    target = module.get<JobMaterialLotService>(JobMaterialLotService);
  });

  afterEach(() => jest.clearAllMocks());

  it('finds scanned lots within tenant only', async () => {
    repo.find.mockResolvedValue([]);

    await target.findByJobOrder('JO-001', 'C1', 'P1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { jobOrderNo: 'JO-001', company: 'C1', plant: 'P1' },
    });
  });

  it('looks up scanned material lot and existing assignment within tenant only', async () => {
    matLotRepo.findOne.mockResolvedValue({
      matUid: 'MAT-001',
      itemCode: 'RM-001',
      initQty: 10,
      company: 'C1',
      plant: 'P1',
    } as MatLot);
    repo.findOne.mockResolvedValue(null);
    const created = { jobOrderNo: 'JO-001', itemCode: 'RM-001', seq: 1, matUid: 'MAT-001' } as JobMaterialLot;
    repo.create.mockReturnValue(created);
    repo.save.mockResolvedValue(created);

    await target.scanAndRegister(
      'JO-001',
      { matUid: 'MAT-001', scannedBy: 'tester' },
      [{ itemCode: 'RM-001', seq: 1 }],
      'C1',
      'P1',
    );

    expect(matLotRepo.findOne).toHaveBeenCalledWith({
      where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
    });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { jobOrderNo: 'JO-001', itemCode: 'RM-001', seq: 1, company: 'C1', plant: 'P1' },
    });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      jobOrderNo: 'JO-001',
      itemCode: 'RM-001',
      seq: 1,
      matUid: 'MAT-001',
      company: 'C1',
      plant: 'P1',
    }));
  });

  it('throws NotFoundException when scanned material lot is missing in tenant', async () => {
    matLotRepo.findOne.mockResolvedValue(null);

    await expect(
      target.scanAndRegister('JO-001', { matUid: 'MAT-001' }, [{ itemCode: 'RM-001', seq: 1 }], 'C1', 'P1'),
    ).rejects.toThrow(NotFoundException);

    expect(matLotRepo.findOne).toHaveBeenCalledWith({
      where: { matUid: 'MAT-001', company: 'C1', plant: 'P1' },
    });
  });

  it('removes scanned lot assignment within tenant only', async () => {
    repo.delete.mockResolvedValue({ affected: 1 } as any);

    await target.remove('JO-001', 'RM-001', 1, 'C1', 'P1');

    expect(repo.delete).toHaveBeenCalledWith({
      jobOrderNo: 'JO-001',
      itemCode: 'RM-001',
      seq: 1,
      company: 'C1',
      plant: 'P1',
    });
  });
});
