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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';

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
  async callProc<T = Record<string, any>>(
    packageName: string,
    procName: string,
    inParams?: Record<string, any>,
  ): Promise<T[]> {
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
      const result = await conn.execute(sql, bindVars, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });

      // SYS_REFCURSOR fetch
      const cursor = (result.outBinds as Record<string, any>)[
        'o_cursor'
      ] as oracledb.ResultSet<any>;
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
   * Oracle 패키지 프로시저 호출 - 다중 SYS_REFCURSOR 반환
   *
   * @param packageName 패키지명
   * @param procName 프로시저명
   * @param cursorNames OUT 커서 파라미터명 배열 (예: ['o_summary', 'o_items'])
   * @param inParams IN 파라미터 (선택)
   * @returns 커서명별 결과 맵 (camelCase 키)
   */
  async callProcMultiCursor<T = Record<string, any>>(
    packageName: string,
    procName: string,
    cursorNames: string[],
    inParams?: Record<string, any>,
  ): Promise<Record<string, T[]>> {
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
      const result = await conn.execute(sql, bindVars, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });

      const output: Record<string, T[]> = {};
      for (const name of cursorNames) {
        const cursor = (result.outBinds as Record<string, any>)[
          name
        ] as oracledb.ResultSet<any>;
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
   * UPPER_SNAKE_CASE 키를 camelCase로 변환
   * 예: { NORMAL_CNT: 5 } -> { normalCnt: 5 }
   */
  private toCamelCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key
        .toLowerCase()
        .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }
}
