/**
 * @file apps/backend/src/common/services/oracle.service.ts
 * @description Oracle 패키지/프로시저 호출 공용 헬퍼 서비스
 *
 * 초보자 가이드:
 * 1. 별도 oracledb 커넥션 풀을 관리하며, 모듈 초기화/종료 시 자동 생성/정리
 * 2. callProc()로 패키지.프로시저를 호출하면 SYS_REFCURSOR 결과를 JS 배열로 반환
 * 3. Oracle 컬럼명(UPPER_SNAKE_CASE)을 camelCase로 자동 변환
 * 4. execute() 호출 시 outFormat: OUT_FORMAT_OBJECT 옵션으로 결과를 객체로 수신
 *
 * 사용 예시:
 *   const rows = await oracleService.callProc<EquipStats>(
 *     'PKG_DASHBOARD', 'SP_EQUIP_STATS'
 *   );
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { isRecord } from '../utils/json-record.util';

/** Oracle 식별자 화이트리스트 패턴 (패키지명/프로시저명 인젝션 방지) */
const SAFE_IDENTIFIER = /^[A-Z][A-Z0-9_$#]{0,29}$/i;
type OracleRow = Record<string, unknown>;
type OracleResultSet = oracledb.ResultSet<OracleRow>;

function validateIdentifier(name: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new BadRequestException(`유효하지 않은 ${label}: "${name}"`);
  }
}

function getOutBinds(outBinds: unknown): Record<string, unknown> {
  if (!isRecord(outBinds)) {
    throw new Error('Oracle outBinds object expected');
  }
  return outBinds;
}

function isOracleResultSet(value: unknown): value is OracleResultSet {
  return isRecord(value) && typeof value.getRows === 'function' && typeof value.close === 'function';
}

function getCursor(outBinds: unknown, name: string): OracleResultSet {
  const cursor = getOutBinds(outBinds)[name];
  if (!isOracleResultSet(cursor)) {
    throw new Error(`Oracle cursor outBind expected: ${name}`);
  }
  return cursor;
}

@Injectable()
export class OracleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OracleService.name);
  private pool: oracledb.Pool;

  constructor(private readonly configService: ConfigService) {}

  /** 모듈 초기화 시 별도 oracledb 커넥션 풀 생성 */
  async onModuleInit(): Promise<void> {
    // connectString 구성 — SID / SERVICE_NAME 분기 (DatabaseModule과 동일)
    const host = this.configService.get<string>('ORACLE_HOST', 'localhost');
    const port = this.configService.get<number>('ORACLE_PORT', 1521);
    const sid = this.configService.get<string>('ORACLE_SID');
    const serviceName = this.configService.get<string>('ORACLE_SERVICE_NAME');

    let connectString: string;
    if (sid) {
      // SID 접속: TNS Descriptor 형식 사용
      connectString =
        `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))` +
        `(CONNECT_DATA=(SID=${sid})))`;
    } else {
      // SERVICE_NAME 접속: EZConnect 형식
      connectString = `${host}:${port}/${serviceName || 'JSHNSMES'}`;
    }

    this.pool = await oracledb.createPool({
      user: this.configService.get<string>('ORACLE_USER'),
      password: this.configService.get<string>('ORACLE_PASSWORD'),
      connectString,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
    this.logger.log(`OracleService 커넥션 풀 생성 완료 (${host}:${port})`);
  }

  /** 모듈 종료 시 커넥션 풀 정리 */
  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.close(0);
      this.logger.log('OracleService 커넥션 풀 종료');
    }
  }

  /**
   * Oracle 패키지 프로시저 호출 - SYS_REFCURSOR 1개 반환
   *
   * @param packageName 패키지명 (예: 'PKG_DASHBOARD')
   * @param procName 프로시저명 (예: 'SP_EQUIP_STATS')
   * @param inParams IN 파라미터 (선택, 예: { p_target_date: new Date() })
   * @returns 커서 결과 배열 (camelCase 키)
   */
  async callProc<T = OracleRow>(
    packageName: string,
    procName: string,
    inParams?: Record<string, unknown>,
  ): Promise<T[]> {
    validateIdentifier(packageName, '패키지명');
    validateIdentifier(procName, '프로시저명');

    let conn: oracledb.Connection | undefined;
    try {
      conn = await this.pool.getConnection();

      // IN 파라미터 + OUT 커서 바인딩 구성
      const bindVars: Record<string, oracledb.BindParameter> = {};
      const paramNames: string[] = [];

      if (inParams) {
        for (const [key, value] of Object.entries(inParams)) {
          bindVars[key] = { dir: oracledb.BIND_IN, val: value };
          paramNames.push(`:${key}`);
        }
      }

      bindVars['o_cursor'] = { dir: oracledb.BIND_OUT, type: oracledb.CURSOR };
      paramNames.push(':o_cursor');

      const sql = `BEGIN ${packageName}.${procName}(${paramNames.join(', ')}); END;`;
      const result = await this.executeWithRetry(conn, sql, bindVars, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });

      // SYS_REFCURSOR fetch
      const cursor = getCursor(result.outBinds, 'o_cursor');
      const rows = await cursor.getRows();
      await cursor.close();

      // UPPER_SNAKE_CASE -> camelCase 변환
      return rows.map((row) => this.toCamelCase(row)) as T[];
    } catch (err) {
      this.logger.error(
        `프로시저 호출 실패: ${packageName}.${procName}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(
        `Oracle 프로시저 호출 실패: ${packageName}.${procName}`,
      );
    } finally {
      if (conn) await conn.close();
    }
  }

  /**
   * Oracle 프로시저 호출 - 스칼라 OUT 파라미터 반환 (커서 없음)
   * 패키지 없이 standalone procedure, N_RETURN/V_RETURN 패턴에 사용
   *
   * @param procName 프로시저명
   * @param outDefs OUT 파라미터 정의 배열
   * @param inParams IN 파라미터 (선택)
   */
  async callProcScalar(
    procName: string,
    outDefs: Array<{ name: string; type: 'NUMBER' | 'STRING' | 'DATE'; maxSize?: number }>,
    inParams?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    validateIdentifier(procName, '프로시저명');

    let conn: oracledb.Connection | undefined;
    try {
      conn = await this.pool.getConnection();

      const bindVars: Record<string, oracledb.BindParameter> = {};
      const paramNames: string[] = [];

      if (inParams) {
        for (const [key, value] of Object.entries(inParams)) {
          bindVars[key] = { dir: oracledb.BIND_IN, val: value };
          paramNames.push(`:${key}`);
        }
      }

      for (const def of outDefs) {
        const oraType =
          def.type === 'NUMBER' ? oracledb.NUMBER :
          def.type === 'DATE'   ? oracledb.DATE   : oracledb.STRING;
        bindVars[def.name] = {
          dir: oracledb.BIND_OUT,
          type: oraType,
          ...(def.maxSize ? { maxSize: def.maxSize } : {}),
        };
        paramNames.push(`:${def.name}`);
      }

      const sql = `BEGIN ${procName}(${paramNames.join(', ')}); END;`;
      const result = await this.executeWithRetry(conn, sql, bindVars);
      return getOutBinds(result.outBinds);
    } catch (err) {
      this.logger.error(
        `프로시저 호출 실패: ${procName}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(`Oracle 프로시저 호출 실패: ${procName}`);
    } finally {
      if (conn) await conn.close();
    }
  }

  /**
   * Oracle 패키지 프로시저 호출 - 다중 SYS_REFCURSOR 반환
   *
   * @param packageName 패키지명
   * @param procName 프로시저명
   * @param cursorNames OUT 커서 파라미터명 배열 (예: ['o_summary', 'o_items'])
   * @param inParams IN 파라미터 (선택)
   * @returns 커서명별 결과 맵 (camelCase 키)
   */
  async callProcMultiCursor<T = OracleRow>(
    packageName: string,
    procName: string,
    cursorNames: string[],
    inParams?: Record<string, unknown>,
  ): Promise<Record<string, T[]>> {
    validateIdentifier(packageName, '패키지명');
    validateIdentifier(procName, '프로시저명');

    let conn: oracledb.Connection | undefined;
    try {
      conn = await this.pool.getConnection();

      const bindVars: Record<string, oracledb.BindParameter> = {};
      const paramNames: string[] = [];

      if (inParams) {
        for (const [key, value] of Object.entries(inParams)) {
          bindVars[key] = { dir: oracledb.BIND_IN, val: value };
          paramNames.push(`:${key}`);
        }
      }

      for (const name of cursorNames) {
        bindVars[name] = { dir: oracledb.BIND_OUT, type: oracledb.CURSOR };
        paramNames.push(`:${name}`);
      }

      const sql = `BEGIN ${packageName}.${procName}(${paramNames.join(', ')}); END;`;
      const result = await this.executeWithRetry(conn, sql, bindVars, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });

      const output: Record<string, T[]> = {};
      for (const name of cursorNames) {
        const cursor = getCursor(result.outBinds, name);
        const rows = await cursor.getRows();
        await cursor.close();
        output[name] = rows.map((row) => this.toCamelCase(row)) as T[];
      }

      return output;
    } catch (err) {
      this.logger.error(
        `프로시저 호출 실패: ${packageName}.${procName}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException(
        `Oracle 프로시저 호출 실패: ${packageName}.${procName}`,
      );
    } finally {
      if (conn) await conn.close();
    }
  }

  /**
   * 패키지 상태 폐기 계열 오류 여부
   * - ORA-04068: existing state of packages has been discarded
   * - ORA-04061/04065: 참조 패키지가 INVALID/변경됨
   * DDL(테이블 변경 등)로 의존 패키지가 무효화된 직후, 기존 상태를 들고 있던 세션의
   * 첫 호출에서 1회성으로 발생한다. 같은 세션에서 재시도하면 정상 동작한다.
   */
  private isPackageStateDiscarded(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /ORA-0406[0-9]|ORA-04068/.test(msg);
  }

  /**
   * 프로시저 익명블록 실행 — 패키지 상태 폐기(ORA-04068 등) 시 같은 커넥션에서 1회 재시도.
   * ORA-04068은 본문 실행 전에 발생하고 상태가 재설정되므로 재시도가 안전하다(이중 실행 없음).
   */
  private async executeWithRetry(
    conn: oracledb.Connection,
    sql: string,
    bindVars: Record<string, oracledb.BindParameter>,
    options?: oracledb.ExecuteOptions,
  ): Promise<oracledb.Result<OracleRow>> {
    try {
      return await conn.execute<OracleRow>(sql, bindVars, options ?? {});
    } catch (err) {
      if (this.isPackageStateDiscarded(err)) {
        this.logger.warn(
          `패키지 상태 폐기 감지(ORA-04068 등) — DDL 직후 1회성 오류로 보고 재시도: ${sql}`,
        );
        return await conn.execute<OracleRow>(sql, bindVars, options ?? {});
      }
      throw err;
    }
  }

  /**
   * UPPER_SNAKE_CASE 키를 camelCase로 변환
   * 예: { NORMAL_CNT: 5 } -> { normalCnt: 5 }
   */
  private toCamelCase(obj: OracleRow): OracleRow {
    const result: OracleRow = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key
        .toLowerCase()
        .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }
}
