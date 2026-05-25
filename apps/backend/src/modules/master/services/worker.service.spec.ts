import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WorkerMaster } from '../../../entities/worker-master.entity';
import { MockLoggerService } from '@test/mock-logger.service';
import { WorkerService } from './worker.service';

describe('WorkerService', () => {
  let target: WorkerService;
  let mockRepo: DeepMocked<Repository<WorkerMaster>>;

  beforeEach(async () => {
    mockRepo = createMock<Repository<WorkerMaster>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        { provide: getRepositoryToken(WorkerMaster), useValue: mockRepo },
      ],
    })
      .setLogger(new MockLoggerService())
      .compile();

    target = module.get<WorkerService>(WorkerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds a worker within tenant only', async () => {
    const item = { workerCode: 'W01', workerName: 'Kim', company: 'C1', plant: 'P1', processIds: '["P10"]' } as WorkerMaster;
    mockRepo.findOne.mockResolvedValue(item);

    const result = await target.findById('W01', 'C1', 'P1');

    expect(result.processIds).toEqual(['P10']);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { workerCode: 'W01', company: 'C1', plant: 'P1' },
    });
  });

  it('throws when tenant scoped worker is missing', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(target.findById('W99', 'C1', 'P1')).rejects.toThrow(NotFoundException);
  });

  it('finds a worker by qr code within tenant only', async () => {
    const item = { workerCode: 'W01', workerName: 'Kim', dept: 'D1' } as WorkerMaster;
    mockRepo.findOne.mockResolvedValue(item);

    await target.findByQrCode('QR01', 'C1', 'P1');

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { qrCode: 'QR01', company: 'C1', plant: 'P1' },
    });
  });

  it('falls back to worker code by qr value within tenant only', async () => {
    const item = { workerCode: 'W01', workerName: 'Kim', dept: 'D1' } as WorkerMaster;
    mockRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(item);

    await target.findByQrCode('W01', 'C1', 'P1');

    expect(mockRepo.findOne).toHaveBeenNthCalledWith(1, {
      where: { qrCode: 'W01', company: 'C1', plant: 'P1' },
    });
    expect(mockRepo.findOne).toHaveBeenNthCalledWith(2, {
      where: { workerCode: 'W01', company: 'C1', plant: 'P1' },
    });
  });

  it('creates a worker within tenant only', async () => {
    const created = { workerCode: 'W01', workerName: 'Kim', company: 'C1', plant: 'P1', processIds: '["P10"]' } as WorkerMaster;
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue(created);
    mockRepo.save.mockResolvedValue(created);

    await target.create({ workerCode: 'W01', workerName: 'Kim', processIds: ['P10'] } as any, 'C1', 'P1');

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { workerCode: 'W01', company: 'C1', plant: 'P1' },
    });
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      workerCode: 'W01',
      company: 'C1',
      plant: 'P1',
      processIds: '["P10"]',
    }));
  });

  it('throws ConflictException when worker code exists in tenant', async () => {
    mockRepo.findOne.mockResolvedValue({ workerCode: 'W01' } as WorkerMaster);

    await expect(target.create({ workerCode: 'W01', workerName: 'Kim' } as any, 'C1', 'P1'))
      .rejects.toThrow(ConflictException);
  });

  it('updates a worker within tenant and strips key columns from payload', async () => {
    const item = { workerCode: 'W01', workerName: 'Old', company: 'C1', plant: 'P1', processIds: null } as WorkerMaster;
    mockRepo.findOne.mockResolvedValue(item);
    mockRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('W01', {
      workerCode: 'W99',
      workerName: 'New',
      company: 'C2',
      plant: 'P2',
      processIds: ['P20'],
    } as any, 'C1', 'P1');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { workerCode: 'W01', company: 'C1', plant: 'P1' },
      { workerName: 'New', processIds: '["P20"]' },
    );
  });

  it('does not pass arbitrary fields from update payload to the repository', async () => {
    const item = { workerCode: 'W01', workerName: 'Old', company: 'C1', plant: 'P1', processIds: null } as WorkerMaster;
    mockRepo.findOne.mockResolvedValue(item);
    mockRepo.update.mockResolvedValue({ affected: 1 } as any);

    await target.update('W01', {
      workerName: 'New',
      externalSource: 'ERP',
    } as any, 'C1', 'P1');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { workerCode: 'W01', company: 'C1', plant: 'P1' },
      { workerName: 'New' },
    );
  });

  it('deletes a worker within tenant only', async () => {
    const item = { workerCode: 'W01', company: 'C1', plant: 'P1', processIds: null } as WorkerMaster;
    mockRepo.findOne.mockResolvedValue(item);
    mockRepo.delete.mockResolvedValue({ affected: 1 } as any);

    await target.delete('W01', 'C1', 'P1');

    expect(mockRepo.delete).toHaveBeenCalledWith({ workerCode: 'W01', company: 'C1', plant: 'P1' });
  });
});
