/**
 * @file services/db-connection.service.ts
 * @description DB 접속 설정(.env) 조회·검증·저장·재시작 서비스
 *
 * 접속 설정의 단일 출처는 apps/backend/.env(.env.local 우선)이며 이 서비스만 그 파일을 쓴다.
 * 읽기 규칙은 database/oracle-env.ts 와 같다(SID 가 있으면 SID, 없으면 SERVICE_NAME).
 *
 * 안전장치:
 * 1. 저장 전 실제 접속을 시도해 성공한 경우에만 파일을 쓴다
 * 2. 쓰기 직전 기존 파일을 타임스탬프 백업으로 남긴다
 * 3. 비밀번호는 응답에 절대 포함하지 않는다(마스킹)
 */
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** PM2 프로세스명 — ecosystem.config.js 의 hanes-backend 와 같아야 한다. */
const PM2_PROCESS_NAME = 'hanes-backend';
const ORACLE_KEYS = [
  'ORACLE_HOST',
  'ORACLE_PORT',
  'ORACLE_USER',
  'ORACLE_PASSWORD',
  'ORACLE_SID',
  'ORACLE_SERVICE_NAME',
] as const;

export interface DbConnectionInput {
  host: string;
  port: number;
  username: string;
  /** 생략하면 저장된 비밀번호를 그대로 사용한다 */
  password?: string;
  sid?: string;
  serviceName?: string;
}

export interface DbConnectionView {
  host: string;
  port: number;
  username: string;
  /** 원문 대신 고정 길이 마스크 */
  passwordMasked: string;
  sid?: string;
  serviceName?: string;
  /** 편집 대상 파일명 (.env 또는 .env.local) */
  envFile: string;
}

export interface DbConnectionStatus extends DbConnectionView {
  /** 파일 값과 구동 중인 값이 달라 재시작해야 반영되는 상태 */
  restartRequired: boolean;
}

export interface DbConnectionTestResult {
  success: boolean;
  message?: string;
  code?: string;
  hint?: string;
}

export interface DbConnectionSaveResult {
  envFile: string;
  backupFile: string;
}

/** 테스트에서 파일 위치·접속·재시작을 대체하기 위한 의존성 */
export interface DbConnectionDeps {
  backendDir?: string;
  probe?: (input: Required<Pick<DbConnectionInput, 'host' | 'port' | 'username' | 'password'>> &
    Pick<DbConnectionInput, 'sid' | 'serviceName'>) => Promise<void>;
  runRestart?: (command: string, args: string[]) => Promise<void>;
  readRuntimeEnv?: (key: string) => string | undefined;
}

const ORA_HINTS: Array<{ code: string; hint: string }> = [
  { code: 'ORA-12541', hint: 'Oracle 리스너가 떠 있지 않거나 host/port 에 닿지 않습니다.' },
  { code: 'ORA-12514', hint: '서비스명(SERVICE_NAME) 또는 SID 가 올바르지 않습니다.' },
  { code: 'ORA-01017', hint: '사용자명 또는 비밀번호가 올바르지 않습니다.' },
  { code: 'ORA-12154', hint: 'TNS 접속 식별자를 해석하지 못했습니다.' },
  { code: 'ORA-28001', hint: '비밀번호가 만료되었습니다. DB에서 먼저 재설정하세요.' },
];

@Injectable()
export class DbConnectionService {
  private readonly logger = new Logger(DbConnectionService.name);
  private readonly backendDir: string;
  private readonly probe: NonNullable<DbConnectionDeps['probe']>;
  private readonly runRestart: NonNullable<DbConnectionDeps['runRestart']>;
  private readonly readRuntimeEnv: NonNullable<DbConnectionDeps['readRuntimeEnv']>;

  constructor(@Optional() deps?: DbConnectionDeps) {
    this.backendDir = deps?.backendDir ?? process.cwd();
    this.probe = deps?.probe ?? ((input) => this.probeWithTypeOrm(input));
    this.runRestart =
      deps?.runRestart ??
      (async (command, args) => {
        await execFileAsync(command, args, { windowsHide: true });
      });
    this.readRuntimeEnv = deps?.readRuntimeEnv ?? ((key) => process.env[key]);
  }

  /** 편집 대상 파일 — .env.local 이 있으면 그 값이 우선하므로 그쪽을 쓴다. */
  private envFileName(): string {
    return fs.existsSync(path.join(this.backendDir, '.env.local')) ? '.env.local' : '.env';
  }

  private envFilePath(): string {
    return path.join(this.backendDir, this.envFileName());
  }

  private readEnvValues(): Record<string, string> {
    const filePath = this.envFilePath();
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`환경설정 파일을 찾을 수 없습니다: ${this.envFileName()}`);
    }
    const values: Record<string, string> = {};
    for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      values[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
    return values;
  }

  private toView(values: Record<string, string>): DbConnectionView {
    const sid = values.ORACLE_SID || undefined;
    return {
      host: values.ORACLE_HOST ?? '',
      port: parseInt(values.ORACLE_PORT || '1521', 10),
      username: values.ORACLE_USER ?? '',
      passwordMasked: values.ORACLE_PASSWORD ? '********' : '',
      ...(sid ? { sid } : { serviceName: values.ORACLE_SERVICE_NAME || undefined }),
      envFile: this.envFileName(),
    };
  }

  /** 화면 표시용 현재 설정 (비밀번호 제외) */
  getCurrent(): DbConnectionView {
    return this.toView(this.readEnvValues());
  }

  /** 파일 값과 구동 중인 값의 차이로 재시작 필요 여부를 판단한다. */
  getStatus(): DbConnectionStatus {
    const values = this.readEnvValues();
    const restartRequired = ORACLE_KEYS.some(
      (key) => (values[key] ?? '') !== (this.readRuntimeEnv(key) ?? ''),
    );
    return { ...this.toView(values), restartRequired };
  }

  /** 입력값으로 실제 접속을 시도한다. 비밀번호를 생략하면 저장된 값을 쓴다. */
  async testConnection(input: DbConnectionInput): Promise<DbConnectionTestResult> {
    const resolved = this.resolveInput(input);
    try {
      await this.probe(resolved);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const matched = ORA_HINTS.find((entry) => message.includes(entry.code));
      return {
        success: false,
        message,
        ...(matched ? { code: matched.code, hint: matched.hint } : {}),
      };
    }
  }

  /** 연결 테스트를 통과한 경우에만 .env 의 ORACLE_* 라인을 교체한다. */
  async save(input: DbConnectionInput): Promise<DbConnectionSaveResult> {
    const result = await this.testConnection(input);
    if (!result.success) {
      throw new BadRequestException(
        `접속 확인에 실패해 저장하지 않았습니다: ${result.hint ?? result.message ?? '알 수 없는 오류'}`,
      );
    }

    const resolved = this.resolveInput(input);
    const filePath = this.envFilePath();
    const original = fs.readFileSync(filePath, 'utf8');

    const backupFile = `${this.envFileName()}.bak-${this.timestamp()}`;
    fs.writeFileSync(path.join(this.backendDir, backupFile), original, 'utf8');

    fs.writeFileSync(filePath, this.applyOracleValues(original, resolved), 'utf8');
    this.logger.log(`DB 접속 설정 저장: ${this.envFileName()} (backup=${backupFile})`);

    return { envFile: this.envFileName(), backupFile };
  }

  /** PM2 로 백엔드 프로세스만 재시작한다(프론트·프록시는 건드리지 않는다). */
  async restart(): Promise<{ process: string }> {
    try {
      await this.runRestart('pm2', ['restart', PM2_PROCESS_NAME]);
      return { process: PM2_PROCESS_NAME };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`재시작에 실패했습니다: ${message}`);
    }
  }

  /** 비밀번호 생략 시 저장된 값으로 채운다. */
  private resolveInput(
    input: DbConnectionInput,
  ): Required<Pick<DbConnectionInput, 'host' | 'port' | 'username' | 'password'>> &
    Pick<DbConnectionInput, 'sid' | 'serviceName'> {
    const password = input.password?.trim() || this.readEnvValues().ORACLE_PASSWORD || '';
    return {
      host: input.host,
      port: input.port,
      username: input.username,
      password,
      sid: input.sid,
      serviceName: input.serviceName,
    };
  }

  /** ORACLE_* 라인만 교체한다. 다른 키·주석·빈 줄은 그대로 둔다. */
  private applyOracleValues(
    source: string,
    input: Required<Pick<DbConnectionInput, 'host' | 'port' | 'username' | 'password'>> &
      Pick<DbConnectionInput, 'sid' | 'serviceName'>,
  ): string {
    // SID 와 SERVICE_NAME 이 동시에 남으면 SID 가 이겨 혼란스러우므로 선택하지 않은 쪽은 빈 값으로 둔다.
    const next: Record<string, string> = {
      ORACLE_HOST: input.host,
      ORACLE_PORT: String(input.port),
      ORACLE_USER: input.username,
      ORACLE_PASSWORD: input.password,
      ORACLE_SID: input.sid ?? '',
      ORACLE_SERVICE_NAME: input.sid ? '' : (input.serviceName ?? ''),
    };

    const lines = source.split(/\r?\n/);
    const written = new Set<string>();
    const replaced = lines.map((line) => {
      const match = /^(\s*)([A-Z0-9_]+)\s*=/.exec(line);
      if (!match) return line;
      const key = match[2];
      if (!(key in next)) return line;
      written.add(key);
      return `${match[1]}${key}=${next[key]}`;
    });

    const missing = ORACLE_KEYS.filter((key) => !written.has(key)).map(
      (key) => `${key}=${next[key]}`,
    );
    if (missing.length === 0) return replaced.join('\n');

    const trailingBlank = replaced[replaced.length - 1] === '';
    if (trailingBlank) replaced.pop();
    return [...replaced, ...missing, ''].join('\n');
  }

  private timestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return (
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    );
  }

  /** 실제 접속 확인 — 입력값만 사용하고 성공 시 즉시 닫는다. */
  private async probeWithTypeOrm(
    input: Required<Pick<DbConnectionInput, 'host' | 'port' | 'username' | 'password'>> &
      Pick<DbConnectionInput, 'sid' | 'serviceName'>,
  ): Promise<void> {
    const dataSource = new DataSource({
      type: 'oracle',
      host: input.host,
      port: input.port,
      username: input.username,
      password: input.password,
      ...(input.sid ? { sid: input.sid } : { serviceName: input.serviceName ?? '' }),
      synchronize: false,
      logging: false,
      entities: [],
    });
    try {
      await dataSource.initialize();
      await dataSource.query('SELECT 1 FROM DUAL');
    } finally {
      if (dataSource.isInitialized) await dataSource.destroy();
    }
  }
}
