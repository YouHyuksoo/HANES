/**
 * @file services/db-connection.service.spec.ts
 * @description DB 접속 설정 서비스 테스트
 *
 * 접속 설정 단일 출처(.env)를 화면에서 편집할 때의 규칙을 고정한다.
 * - 비밀번호는 응답에 절대 노출하지 않는다
 * - 연결 테스트를 통과하지 못하면 저장하지 않는다
 * - 저장은 ORACLE_* 라인만 교체하고 다른 키·주석을 보존한다
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { DbConnectionService } from './db-connection.service';

const ENV_SAMPLE = [
  '# HANES backend env',
  'NODE_ENV=development',
  '',
  '# DB',
  'ORACLE_HOST=10.1.10.35',
  'ORACLE_PORT=1527',
  'ORACLE_USER=test',
  'ORACLE_PASSWORD=secret-pw',
  'ORACLE_SERVICE_NAME=JSHNSMES',
  '',
  'JWT_SECRET=keep-me',
  '',
].join('\n');

describe('DbConnectionService', () => {
  let tmpDir: string;
  let envPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hanes-dbconn-'));
    envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, ENV_SAMPLE, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** probe 는 실제 DB 접속을 대신한다. 기본은 성공. */
  function createService(options?: {
    probe?: (input: Record<string, unknown>) => Promise<void>;
    runRestart?: (command: string, args: string[]) => Promise<void>;
    runtime?: Record<string, string | undefined>;
  }) {
    return new DbConnectionService({
      backendDir: tmpDir,
      probe: options?.probe ?? (async () => undefined),
      runRestart: options?.runRestart ?? (async () => undefined),
      readRuntimeEnv: (key: string) =>
        options?.runtime
          ? options.runtime[key]
          : {
              ORACLE_HOST: '10.1.10.35',
              ORACLE_PORT: '1527',
              ORACLE_USER: 'test',
              ORACLE_PASSWORD: 'secret-pw',
              ORACLE_SERVICE_NAME: 'JSHNSMES',
            }[key],
    });
  }

  describe('getCurrent', () => {
    it('비밀번호를 원문 대신 마스킹해서 반환해야 한다', () => {
      const view = createService().getCurrent();

      expect(view.host).toBe('10.1.10.35');
      expect(view.serviceName).toBe('JSHNSMES');
      expect(view.passwordMasked).toBe('********');
      expect(JSON.stringify(view)).not.toContain('secret-pw');
    });

    it('편집 대상 파일 경로를 알려줘야 한다', () => {
      expect(createService().getCurrent().envFile).toBe('.env');
    });

    it('.env.local 이 있으면 그 파일을 편집 대상으로 삼아야 한다', () => {
      fs.writeFileSync(path.join(tmpDir, '.env.local'), 'ORACLE_HOST=local-host\n', 'utf8');

      const view = createService().getCurrent();

      expect(view.envFile).toBe('.env.local');
      expect(view.host).toBe('local-host');
    });
  });

  describe('getStatus', () => {
    it('구동 중인 값과 파일 값이 같으면 재시작이 필요 없다', () => {
      expect(createService().getStatus().restartRequired).toBe(false);
    });

    it('파일 값이 구동 중인 값과 다르면 재시작이 필요하다', () => {
      const service = createService({
        runtime: {
          ORACLE_HOST: '10.1.10.99',
          ORACLE_PORT: '1527',
          ORACLE_USER: 'test',
          ORACLE_PASSWORD: 'secret-pw',
          ORACLE_SERVICE_NAME: 'JSHNSMES',
        },
      });

      expect(service.getStatus().restartRequired).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('접속에 성공하면 success 를 돌려줘야 한다', async () => {
      const result = await createService().testConnection({
        host: 'h',
        port: 1521,
        username: 'u',
        password: 'p',
        serviceName: 'S',
      });

      expect(result.success).toBe(true);
    });

    it('접속 실패 시 ORA 코드와 힌트를 함께 돌려줘야 한다', async () => {
      const service = createService({
        probe: async () => {
          throw new Error('ORA-01017: invalid username/password');
        },
      });

      const result = await service.testConnection({
        host: 'h',
        port: 1521,
        username: 'u',
        password: 'bad',
        serviceName: 'S',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('ORA-01017');
      expect(result.hint).toContain('비밀번호');
    });

    it('비밀번호를 생략하면 저장된 값으로 접속을 시도해야 한다', async () => {
      const seen: Array<Record<string, unknown>> = [];
      const service = createService({
        probe: async (input) => {
          seen.push(input);
        },
      });

      await service.testConnection({
        host: 'h',
        port: 1521,
        username: 'u',
        serviceName: 'S',
      });

      expect(seen[0].password).toBe('secret-pw');
    });
  });

  describe('save', () => {
    it('ORACLE_* 라인만 바꾸고 다른 키와 주석은 보존해야 한다', async () => {
      await createService().save({
        host: '10.9.9.9',
        port: 1521,
        username: 'newuser',
        password: 'newpw',
        serviceName: 'NEWSVC',
      });

      const saved = fs.readFileSync(envPath, 'utf8');
      expect(saved).toContain('ORACLE_HOST=10.9.9.9');
      expect(saved).toContain('ORACLE_USER=newuser');
      expect(saved).toContain('ORACLE_PASSWORD=newpw');
      expect(saved).toContain('ORACLE_SERVICE_NAME=NEWSVC');
      expect(saved).toContain('JWT_SECRET=keep-me');
      expect(saved).toContain('# HANES backend env');
      expect(saved).toContain('NODE_ENV=development');
    });

    it('비밀번호를 생략하면 기존 비밀번호를 유지해야 한다', async () => {
      await createService().save({
        host: '10.9.9.9',
        port: 1521,
        username: 'newuser',
        serviceName: 'NEWSVC',
      });

      expect(fs.readFileSync(envPath, 'utf8')).toContain('ORACLE_PASSWORD=secret-pw');
    });

    it('SID 로 저장하면 SERVICE_NAME 을 비워 서로 충돌하지 않게 해야 한다', async () => {
      await createService().save({
        host: '10.9.9.9',
        port: 1521,
        username: 'u',
        password: 'p',
        sid: 'ORCL',
      });

      const saved = fs.readFileSync(envPath, 'utf8');
      expect(saved).toContain('ORACLE_SID=ORCL');
      expect(saved).toContain('ORACLE_SERVICE_NAME=');
      expect(saved).not.toContain('ORACLE_SERVICE_NAME=JSHNSMES');
    });

    it('연결 테스트에 실패하면 저장하지 않고 예외를 던져야 한다', async () => {
      const service = createService({
        probe: async () => {
          throw new Error('ORA-12541: TNS:no listener');
        },
      });

      await expect(
        service.save({ host: 'bad', port: 1521, username: 'u', password: 'p', serviceName: 'S' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(fs.readFileSync(envPath, 'utf8')).toContain('ORACLE_HOST=10.1.10.35');
    });

    it('저장 전에 기존 파일을 백업해야 한다', async () => {
      const result = await createService().save({
        host: '10.9.9.9',
        port: 1521,
        username: 'u',
        password: 'p',
        serviceName: 'S',
      });

      const backupPath = path.join(tmpDir, result.backupFile);
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(fs.readFileSync(backupPath, 'utf8')).toBe(ENV_SAMPLE);
    });
  });

  describe('restart', () => {
    it('pm2 로 백엔드 프로세스만 재시작해야 한다', async () => {
      const calls: Array<{ command: string; args: string[] }> = [];
      const service = createService({
        runRestart: async (command, args) => {
          calls.push({ command, args });
        },
      });

      await service.restart();

      expect(calls).toHaveLength(1);
      expect(calls[0].command).toBe('pm2');
      expect(calls[0].args).toEqual(['restart', 'hanes-backend']);
    });

    it('재시작 명령이 실패하면 원인을 담아 예외를 던져야 한다', async () => {
      const service = createService({
        runRestart: async () => {
          throw new Error('pm2: command not found');
        },
      });

      await expect(service.restart()).rejects.toThrow('pm2');
    });
  });
});
