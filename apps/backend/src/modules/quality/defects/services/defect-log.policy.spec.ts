import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DefectLogService } from './defect-log.service';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { RepairLog } from '../../../../entities/repair-log.entity';
import { ProdResult } from '../../../../entities/prod-result.entity';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { FgLabel } from '../../../../entities/fg-label.entity';
import { DefectCodeMaster } from '../../../../entities/defect-code-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';

describe('DefectLogService policy', () => {
  let target: DefectLogService;
  let mockDefectLogRepo: DeepMocked<Repository<DefectLog>>;
  let mockReworkOrderRepo: DeepMocked<Repository<ReworkOrder>>;

  beforeEach(async () => {
    mockDefectLogRepo = createMock<Repository<DefectLog>>();
    mockReworkOrderRepo = createMock<Repository<ReworkOrder>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefectLogService,
        { provide: getRepositoryToken(DefectLog), useValue: mockDefectLogRepo },
        { provide: getRepositoryToken(RepairLog), useValue: createMock<Repository<RepairLog>>() },
        { provide: getRepositoryToken(ProdResult), useValue: createMock<Repository<ProdResult>>() },
        { provide: getRepositoryToken(ReworkOrder), useValue: mockReworkOrderRepo },
        { provide: getRepositoryToken(FgLabel), useValue: createMock<Repository<FgLabel>>() },
        { provide: getRepositoryToken(DefectCodeMaster), useValue: createMock<Repository<DefectCodeMaster>>() },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get(DefectLogService);
  });

  afterEach(() => jest.clearAllMocks());

  it('blocks delete when linked rework exists', async () => {
    mockDefectLogRepo.findOne.mockResolvedValue({
      id: 1,
      occurAt: new Date('2026-04-08T00:00:00.000Z'),
      seq: 1,
      prodResultNo: 'PR-001',
      qty: 2,
    } as any);
    mockReworkOrderRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001' } as any);

    await expect(target.delete('1')).rejects.toThrow(BadRequestException);
  });

  it('blocks status changes when linked rework exists', async () => {
    mockDefectLogRepo.findOne.mockResolvedValue({
      id: 1,
      occurAt: new Date('2026-04-08T00:00:00.000Z'),
      seq: 1,
      prodResultNo: 'PR-001',
      qty: 2,
      status: 'WAIT',
    } as any);
    mockReworkOrderRepo.findOne.mockResolvedValue({ reworkNo: 'RW-001' } as any);

    await expect(target.changeStatus('1', { status: 'SCRAP' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});
