import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { SqlExecutor } from './sql.executor';

describe('SqlExecutor', () => {
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let executor: SqlExecutor;

  const baseJob = {
    company: 'C1',
    plantCd: 'P1',
    jobCode: 'SQL_JOB',
    execType: 'SQL',
    timeoutSec: 300,
    execParams: null,
  } as SchedulerJob;

  beforeEach(() => {
    dataSource = {
      query: jest.fn().mockResolvedValue([{ ok: 1 }]),
    };
    executor = new SqlExecutor(dataSource as unknown as DataSource);
  });

  it('should bind scheduler job tenant to named SQL tenant parameters', async () => {
    await executor.execute({
      ...baseJob,
      execTarget: 'SELECT * FROM INTER_LOGS WHERE COMPANY = :company AND PLANT_CD = :plantCd',
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      'SELECT * FROM INTER_LOGS WHERE COMPANY = :company AND PLANT_CD = :plantCd',
      { company: 'C1', plantCd: 'P1' },
    );
  });

  it('should reject DELETE SQL without company and plant tenant predicates', async () => {
    await expect(
      executor.execute({
        ...baseJob,
        execTarget: "DELETE FROM INTER_LOGS WHERE STATUS = 'SUCCESS'",
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('should allow DELETE SQL when scoped by scheduler job tenant', async () => {
    await executor.execute({
      ...baseJob,
      execTarget: 'DELETE FROM INTER_LOGS WHERE COMPANY = :company AND PLANT = :plant AND STATUS = :status',
      execParams: JSON.stringify({ status: 'SUCCESS', company: 'OTHER', plant: 'OTHER' }),
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      'DELETE FROM INTER_LOGS WHERE COMPANY = :company AND PLANT = :plant AND STATUS = :status',
      { status: 'SUCCESS', company: 'C1', plant: 'P1' },
    );
  });
});
