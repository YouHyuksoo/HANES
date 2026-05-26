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

  it('should reject non-sequential positional binds', async () => {
    await expect(
      executor.execute({
        ...baseJob,
        execTarget: 'SELECT * FROM INTER_LOGS WHERE COMPANY = :1 AND STATUS = :3',
        execParams: JSON.stringify({ company: 'C1', status: 'SUCCESS' }),
      }),
    ).rejects.toThrow('1부터 순차');

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('should reject positional binds with leading zeros', async () => {
    // :01과 :1은 oracledb에서 별개 바인드. Number 기반 dedup의 false negative 회귀 방지.
    await expect(
      executor.execute({
        ...baseJob,
        execTarget: 'SELECT * FROM INTER_LOGS WHERE COMPANY = :01 AND STATUS = :1',
        execParams: JSON.stringify({ company: 'C1', status: 'SUCCESS' }),
      }),
    ).rejects.toThrow('1부터 순차');

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('should ignore :숫자 patterns inside string literals when validating positional binds', async () => {
    // 리터럴 '12:30:45' 안의 :30 / :45 가 매칭되어 정상 SQL이 거부되던 false positive 회귀 방지.
    await executor.execute({
      ...baseJob,
      execTarget:
        "SELECT * FROM INTER_LOGS WHERE COMPANY = :1 AND STATUS = :2 AND MEMO = '12:30:45'",
      execParams: JSON.stringify({ company: 'C1', status: 'SUCCESS' }),
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE COMPANY = :1 AND STATUS = :2'),
      ['C1', 'SUCCESS'],
    );
  });

  it('should ignore :숫자 patterns inside block comments when validating positional binds', async () => {
    await executor.execute({
      ...baseJob,
      execTarget:
        'SELECT /* tuning ref :99 */ * FROM INTER_LOGS WHERE COMPANY = :1 AND STATUS = :2',
      execParams: JSON.stringify({ company: 'C1', status: 'SUCCESS' }),
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE COMPANY = :1 AND STATUS = :2'),
      ['C1', 'SUCCESS'],
    );
  });
});
