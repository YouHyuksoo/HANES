import { execFile } from 'child_process';
import * as fs from 'fs';
import { SchedulerJob } from '../../../entities/scheduler-job.entity';
import { ScriptExecutor } from './script.executor';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');

  return {
    ...actual,
    existsSync: jest.fn(),
    realpathSync: jest.fn(),
  };
});

describe('ScriptExecutor', () => {
  let executor: ScriptExecutor;
  let callOptions: Record<string, unknown> | null = null;
  let parsedArgs: string[] = [];

  const baseJob = {
    company: 'C1',
    plantCd: 'P1',
    jobCode: 'SCRIPT_JOB',
    execType: 'SCRIPT',
    execTarget: 'C:\\scripts\\task.bat',
    timeoutSec: 300,
    execParams: null,
  } as SchedulerJob;

  beforeEach(() => {
    executor = new ScriptExecutor();
    callOptions = null;
    parsedArgs = [];
    (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);
    (fs.realpathSync as unknown as jest.Mock).mockReturnValue('C:\\scripts\\task.bat');
    (execFile as unknown as jest.Mock).mockReset();
    (execFile as unknown as jest.Mock).mockImplementation((
      _path: string,
      args: string[],
      options: Record<string, unknown>,
      callback: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callOptions = options;
      parsedArgs = args;
      callback(null, 'done', '');
    });
  });

  afterEach(() => {
    (execFile as unknown as jest.Mock).mockReset();
    (fs.existsSync as unknown as jest.Mock).mockReset();
    (fs.realpathSync as unknown as jest.Mock).mockReset();
  });

  it('should force tenant envs into script execution environment', async () => {
    await executor.execute({
      ...baseJob,
      execParams: JSON.stringify({ args: ['--dry-run'] }),
    });

    expect(callOptions).not.toBeNull();
    const env = (callOptions?.env || {}) as NodeJS.ProcessEnv;
    expect(env['SCHEDULER_COMPANY']).toBe('C1');
    expect(env['SCHEDULER_PLANT']).toBe('P1');
    expect(env['SCHEDULER_PLANT_CD']).toBe('P1');
  });

  it('should pass array execParams directly as script arguments', async () => {
    await executor.execute({
      ...baseJob,
      execParams: JSON.stringify(['--dry-run', 'force']),
    });

    expect(parsedArgs).toEqual(['--dry-run', 'force']);
  });

  it('should reject invalid execParams JSON', async () => {
    await expect(
      executor.execute({
        ...baseJob,
        execParams: '{',
      }),
    ).rejects.toThrow('execParams JSON 파싱 실패');
  });
});
