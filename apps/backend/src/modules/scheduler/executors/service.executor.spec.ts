import { BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { SERVICE_CLASS_MAP } from '../config/scheduler-security.config';
import { ServiceExecutor } from './service.executor';

class MockInterfaceService {
  scheduledBulkRetry = jest.fn().mockResolvedValue({ affectedRows: 2 });
}

class MockDbBackupService {
  runBackup = jest.fn().mockResolvedValue({ affectedRows: 1 });
}

describe('ServiceExecutor', () => {
  let moduleRef: jest.Mocked<Pick<ModuleRef, 'get'>>;
  let executor: ServiceExecutor;
  let interfaceService: MockInterfaceService;
  let dbBackupService: MockDbBackupService;

  const baseJob = {
    company: 'C1',
    plantCd: 'P1',
    jobCode: 'JOB_001',
    execType: 'SERVICE',
    execParams: null,
  } as SchedulerJob;

  beforeEach(() => {
    interfaceService = new MockInterfaceService();
    dbBackupService = new MockDbBackupService();
    moduleRef = {
      get: jest.fn(),
    };
    executor = new ServiceExecutor(moduleRef as unknown as ModuleRef);

    SERVICE_CLASS_MAP.clear();
    SERVICE_CLASS_MAP.set('InterfaceService', MockInterfaceService);
    SERVICE_CLASS_MAP.set('DbBackupService', MockDbBackupService);

    moduleRef.get.mockImplementation((classRef) => {
      if (classRef === MockInterfaceService) return interfaceService;
      if (classRef === MockDbBackupService) return dbBackupService;
      return undefined;
    });
  });

  it('should pass scheduler job tenant to tenant-aware service methods', async () => {
    await executor.execute({
      ...baseJob,
      execTarget: 'InterfaceService.scheduledBulkRetry',
    });

    expect(interfaceService.scheduledBulkRetry).toHaveBeenCalledWith('C1', 'P1');
  });

  it('should pass execParams to parameter-driven service methods', async () => {
    await executor.execute({
      ...baseJob,
      execTarget: 'DbBackupService.runBackup',
      execParams: JSON.stringify({ includeData: true }),
    });

    expect(dbBackupService.runBackup).toHaveBeenCalledWith({ includeData: true });
  });

  it('should reject invalid execParams JSON', async () => {
    await expect(
      executor.execute({
        ...baseJob,
        execTarget: 'DbBackupService.runBackup',
        execParams: '{',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
