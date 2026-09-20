/**
 * @file database/oracle-pool-extra.spec.ts
 * @description oracledb 풀 옵션 단일 출처(oraclePoolExtra) — 죽은 커넥션 감지 옵션과 callTimeout 세션 콜백
 *   (2026-09-20 VPN 구간 끊김 → NJS-040 queueTimeout 30초 대량 발생 재발 방지)
 */
import { oraclePoolExtra, type OraclePoolConnectionLike } from './oracle-env';

const noEnv = () => undefined;

describe('oraclePoolExtra', () => {
  it('기본값: 끊긴 소켓을 빨리 걸러내는 옵션이 모두 켜져 있다', () => {
    const extra = oraclePoolExtra(noEnv);
    expect(extra).toMatchObject({
      poolMax: 10, poolMin: 2, poolIncrement: 1, poolTimeout: 60,
      queueTimeout: 30000, stmtCacheSize: 30,
      connectTimeout: 10, poolPingInterval: 10, poolPingTimeout: 3000,
    });
    // expireTime 은 분 단위 — 30 이면 30분이라 무의미했다. 1분이어야 한다.
    expect(extra.expireTime).toBe(1);
    expect(typeof extra.sessionCallback).toBe('function');
  });

  it('sessionCallback 은 새 세션에 callTimeout(기본 30초)을 심고 콜백을 부른다', () => {
    const extra = oraclePoolExtra(noEnv);
    const conn: OraclePoolConnectionLike = {};
    const cb = jest.fn();
    extra.sessionCallback(conn, '', cb);
    expect(conn.callTimeout).toBe(30000);
    expect(cb).toHaveBeenCalledWith();
  });

  it('환경변수로 풀 크기·대기·호출 타임아웃을 조정할 수 있다', () => {
    const env: Record<string, string> = {
      ORACLE_POOL_MAX: '20', ORACLE_QUEUE_TIMEOUT_MS: '15000', ORACLE_CALL_TIMEOUT_MS: '12000',
    };
    const extra = oraclePoolExtra((key) => env[key]);
    expect(extra.poolMax).toBe(20);
    expect(extra.queueTimeout).toBe(15000);
    const conn: OraclePoolConnectionLike = {};
    extra.sessionCallback(conn, '', () => undefined);
    expect(conn.callTimeout).toBe(12000);
  });

  it('숫자가 아니거나 음수인 환경변수는 기본값으로 돌아간다', () => {
    const env: Record<string, string> = { ORACLE_POOL_MAX: 'abc', ORACLE_QUEUE_TIMEOUT_MS: '-1' };
    const extra = oraclePoolExtra((key) => env[key]);
    expect(extra.poolMax).toBe(10);
    expect(extra.queueTimeout).toBe(30000);
  });
});
