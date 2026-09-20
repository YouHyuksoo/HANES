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

/** oracledb 풀 커넥션 — sessionCallback 이 받는 최소 형태 */
export interface OraclePoolConnectionLike {
  callTimeout?: number;
}

export interface OraclePoolExtra {
  poolMax: number;
  poolMin: number;
  poolIncrement: number;
  /** 유휴 커넥션을 풀에서 정리하기까지의 시간(초) */
  poolTimeout: number;
  /** 풀이 가득 찼을 때 요청이 커넥션을 기다리는 최대 시간(ms). 넘기면 NJS-040 */
  queueTimeout: number;
  stmtCacheSize: number;
  /** 새 커넥션 수립 타임아웃(초) — 네트워크 끊김을 빨리 감지 */
  connectTimeout: number;
  /**
   * TCP keepalive 주기 — **단위는 분**(oracledb thin 은 ×60000 해서 setKeepAlive 에 넘긴다).
   * 1 = 1분. 0 이면 keepalive 를 켜지 않아 죽은 소켓이 OS 기본(2시간)까지 남는다.
   */
  expireTime: number;
  /** 풀에서 꺼낼 때 커넥션 핑 검사 주기(초). 이 시간 이상 놀았던 커넥션만 핑한다 */
  poolPingInterval: number;
  /** 핑 자체의 타임아웃(ms) — 죽은 소켓에 핑이 매달리지 않게 */
  poolPingTimeout: number;
  /** pool.getStatistics() 활성 — /system/health 가 큐 길이·NJS-040 누적을 읽는다(비용은 카운터 증가뿐) */
  enableStatistics: boolean;
  /** 새 세션마다 callTimeout 을 심는다 — 죽은 소켓 위의 진행 중 쿼리가 무한정 기다리지 않게 */
  sessionCallback: (conn: OraclePoolConnectionLike, requestedTag: string, cb: (err?: Error) => void) => void;
}

/** 정수 환경변수. 비어 있거나 숫자가 아니면 기본값 */
function intEnv(read: EnvReader, key: string, fallback: number): number {
  const raw = read(key)?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * oracledb 풀 옵션 단일 출처 — 런타임(DatabaseModule)과 CLI(data-source)가 같은 값을 쓴다.
 *
 * 왜 이 값들인가(2026-09-20 VPN 구간 끊김으로 NJS-040 queueTimeout 30초 대량 발생):
 * - 죽은 소켓을 붙든 커넥션이 풀을 다 차지하면 새 요청이 queueTimeout 까지 기다렸다 500 이 난다.
 * - connectTimeout / poolPingTimeout / expireTime(1분) 으로 끊긴 커넥션을 빨리 걸러내고,
 * - callTimeout 으로 이미 나간 쿼리도 상한 안에 실패시켜 커넥션을 풀에 돌려준다
 *   (callTimeout 초과 커넥션은 드라이버가 사용불가로 표시해 반납 시 폐기한다).
 *
 * 환경변수로 조정: ORACLE_POOL_MAX, ORACLE_QUEUE_TIMEOUT_MS, ORACLE_CALL_TIMEOUT_MS
 */
export function oraclePoolExtra(read: EnvReader = processEnvReader): OraclePoolExtra {
  const callTimeoutMs = intEnv(read, 'ORACLE_CALL_TIMEOUT_MS', 30000);
  return {
    poolMax: intEnv(read, 'ORACLE_POOL_MAX', 10),
    poolMin: 2,
    poolIncrement: 1,
    poolTimeout: 60,
    queueTimeout: intEnv(read, 'ORACLE_QUEUE_TIMEOUT_MS', 30000),
    stmtCacheSize: 30,
    connectTimeout: 10,
    expireTime: 1,
    poolPingInterval: 10,
    poolPingTimeout: 3000,
    enableStatistics: true,
    sessionCallback: (conn, _requestedTag, cb) => {
      conn.callTimeout = callTimeoutMs;
      cb();
    },
  };
}

/** 로그용 요약 (비밀번호 제외) */
export function describeOracleTarget(read: EnvReader = processEnvReader): string {
  const env = readOracleEnv(read);
  const target = env.sid ? `SID=${env.sid}` : `SERVICE=${env.serviceName}`;
  return `${env.host}:${env.port} ${target} USER=${env.username}`;
}
