import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      execParams: JSON.stringify({ '1': 'C1', '2': 'SUCCESS' }),
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
      execParams: JSON.stringify({ '1': 'C1', '2': 'SUCCESS' }),
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE COMPANY = :1 AND STATUS = :2'),
      ['C1', 'SUCCESS'],
    );
  });

  it('positional bind는 execParams 키 순서가 아니라 SQL의 :N 순서로 매핑되어야 한다', async () => {
    // 사용자 JSON 키 입력 순서가 매핑을 좌우하던 silent miswire 회귀 방지.
    await executor.execute({
      ...baseJob,
      execTarget: 'SELECT * FROM T WHERE A = :1 AND B = :2 AND C = :3',
      execParams: JSON.stringify({ '3': 30, '1': 10, '2': 20 }),
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('A = :1 AND B = :2 AND C = :3'),
      [10, 20, 30],
    );
  });

  it('positional bind가 반복되면 SQL 등장 횟수만큼 같은 값을 전달해야 한다', async () => {
    await executor.execute({
      ...baseJob,
      execTarget: 'SELECT * FROM T WHERE A = :1 OR B = :1 OR C = :2',
      execParams: JSON.stringify({ '1': 10, '2': 20 }),
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('A = :1 OR B = :1 OR C = :2'),
      [10, 10, 20],
    );
  });

  it('positional bind 배열은 숫자 정렬이 아니라 SQL 등장 순서를 따라야 한다', async () => {
    await executor.execute({
      ...baseJob,
      execTarget: 'SELECT * FROM T WHERE B = :2 AND A = :1',
      execParams: JSON.stringify({ '1': 10, '2': 20 }),
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('B = :2 AND A = :1'),
      [20, 10],
    );
  });

  it('positional bind에 누락된 :N 값이 있으면 BadRequestException을 던져야 한다', async () => {
    await expect(
      executor.execute({
        ...baseJob,
        execTarget: 'SELECT * FROM T WHERE A = :1 AND B = :2',
        execParams: JSON.stringify({ '1': 10 }),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('위치 바인드와 이름 바인드의 혼용은 거부되어야 한다', async () => {
    // hasPositional && namedBinds.size > 0 silent miswire 회귀 방지.
    await expect(
      executor.execute({
        ...baseJob,
        execTarget: 'SELECT * FROM T WHERE A = :1 AND COMPANY = :company',
        execParams: JSON.stringify({ '1': 'X' }),
      }),
    ).rejects.toThrow('혼용할 수 없습니다');

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('문자열 리터럴 안의 :company / :plantCd 토큰은 DELETE 테넌트 가드를 우회할 수 없다', async () => {
    // sanitization 전에 extractNamedBinds 가 raw SQL 을 스캔하던 우회 공격 회귀 방지.
    await expect(
      executor.execute({
        ...baseJob,
        execTarget:
          "DELETE FROM INTER_LOGS WHERE STATUS = 'X :company :plantCd'",
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('Oracle 짝-구분자 q-quote 내부의 :N 토큰도 sanitization 으로 제거되어야 한다', async () => {
    // q'[...]' 는 strip 되지 않아 :company 가 namedBinds 에 새던 우회 공격 회귀 방지.
    await expect(
      executor.execute({
        ...baseJob,
        execTarget:
          "DELETE FROM INTER_LOGS WHERE STATUS = q'[memo :company :plantCd]'",
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
