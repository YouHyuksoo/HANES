/**
 * @file database/oracle-env.ts
 * @description Oracle 접속 설정 단일 출처 — apps/backend/.env(.env.local 우선)
 *
 * 백엔드의 모든 Oracle 연결(런타임 TypeORM, oracledb 풀, 마이그레이션 CLI,
 * 시드 스크립트, 연결 테스트)은 이 파일을 거쳐 같은 값을 읽는다.
 * 접속 대상을 바꾸려면 apps/backend/.env 만 수정하고 재시작한다.
 *
 * 값이 비어 있으면 임의 기본값으로 다른 DB에 붙지 않고 즉시 실패한다.
 */

/** 환경변수 조회 함수 (NestJS ConfigService 등으로 교체 가능) */
export type EnvReader = (key: string) => string | undefined;

const processEnvReader: EnvReader = (key) => process.env[key];

export interface OracleEnv {
  host: string;
  port: number;
  username: string;
  password: string;
  /** ORACLE_SID 가 설정된 경우에만 값이 있다 */
  sid?: string;
  /** ORACLE_SID 가 없을 때 사용하는 서비스명 */
  serviceName?: string;
}

function required(read: EnvReader, key: string): string {
  const value = read(key)?.trim();
  if (!value) {
    throw new Error(
      `[oracle-env] 환경변수 ${key} 가 비어 있습니다. apps/backend/.env(.env.local) 를 확인하세요.`,
    );
  }
  return value;
}

/** .env 에서 Oracle 접속 정보를 읽는다. 필수 값이 없으면 예외를 던진다. */
export function readOracleEnv(read: EnvReader = processEnvReader): OracleEnv {
  const sid = read('ORACLE_SID')?.trim();
  const serviceName = read('ORACLE_SERVICE_NAME')?.trim();

  if (!sid && !serviceName) {
    throw new Error(
      '[oracle-env] ORACLE_SID 또는 ORACLE_SERVICE_NAME 중 하나는 필요합니다. apps/backend/.env 를 확인하세요.',
    );
  }

  return {
    host: required(read, 'ORACLE_HOST'),
    port: parseInt(read('ORACLE_PORT')?.trim() || '1521', 10),
    username: required(read, 'ORACLE_USER'),
    password: required(read, 'ORACLE_PASSWORD'),
    ...(sid ? { sid } : { serviceName }),
  };
}

/** TypeORM(oracle) 커넥션 옵션 조각. SID 가 있으면 SID, 없으면 serviceName 으로 붙는다. */
export function oracleTypeOrmConnection(
  read: EnvReader = processEnvReader,
): Pick<OracleEnv, 'host' | 'port' | 'username' | 'password'> &
  ({ sid: string } | { serviceName: string }) {
  const env = readOracleEnv(read);
  const { host, port, username, password } = env;
  return env.sid
    ? { host, port, username, password, sid: env.sid }
    : { host, port, username, password, serviceName: env.serviceName as string };
}

/** oracledb connectString. SID 는 TNS Descriptor, 서비스명은 EZConnect 형식이다. */
export function oracleConnectString(read: EnvReader = processEnvReader): string {
  const env = readOracleEnv(read);
  if (env.sid) {
    return (
      `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${env.host})(PORT=${env.port}))` +
      `(CONNECT_DATA=(SID=${env.sid})))`
    );
  }
  return `${env.host}:${env.port}/${env.serviceName}`;
}

/** 로그용 요약 (비밀번호 제외) */
export function describeOracleTarget(read: EnvReader = processEnvReader): string {
  const env = readOracleEnv(read);
  const target = env.sid ? `SID=${env.sid}` : `SERVICE=${env.serviceName}`;
  return `${env.host}:${env.port} ${target} USER=${env.username}`;
}
