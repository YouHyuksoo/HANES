/**
 * @file src/modules/num-rule/num-rule.service.ts
 * @description 채번 서비스 — SELECT FOR UPDATE 기반 동시성 안전 번호 생성
 *
 * 초보자 가이드:
 * 1. **nextNumber()**: NUM_RULE_MASTERS 테이블의 규칙에 따라 다음 번호 생성
 * 2. **동시성 보장**: SELECT FOR UPDATE로 행 잠금 → 동시 호출 시 직렬화
 * 3. **리셋 로직**: DAILY/MONTHLY/YEARLY/NONE에 따라 시퀀스 자동 초기화
 * 4. **패턴 치환**: {YYYY}{MM}{DD}-{SEQ} + PREFIX/SUFFIX → ARR20260224-0001
 * 5. **사용법**: QueryRunner 트랜잭션 안에서 nextNumber(queryRunner, 'ARRIVAL') 호출
 *
 * 주의: 반드시 트랜잭션 내에서 호출해야 함 (SELECT FOR UPDATE 잠금이 COMMIT/ROLLBACK에 해제)
 */

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

interface NumRule {
  PATTERN: string;
  PREFIX: string | null;
  SUFFIX: string | null;
  SEQ_LENGTH: number;
  CURRENT_SEQ: number;
  RESET_TYPE: string;
  LAST_RESET: Date | null;
}

@Injectable()
export class NumRuleService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 독립 트랜잭션으로 다음 번호 생성 (트랜잭션 없이 호출 가능)
   * — 내부에서 자체 QueryRunner 생성 → COMMIT → 해제
   * — 결번 허용 (롤백해도 번호는 소비됨)
   */
  async nextNumber(ruleType: string, userId: string = 'SYSTEM'): Promise<string> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const result = await this.generateNumber(qr, ruleType, userId);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * 기존 트랜잭션에 참여하여 다음 번호 생성
   * — 호출자의 QueryRunner를 사용 → 롤백 시 시퀀스도 복원됨 (결번 없음)
   * — 주의: 호출자가 반드시 COMMIT/ROLLBACK 해야 잠금 해제됨
   */
  async nextNumberInTx(
    queryRunner: QueryRunner,
    ruleType: string,
    userId: string = 'SYSTEM',
  ): Promise<string> {
    return this.generateNumber(queryRunner, ruleType, userId);
  }

  /**
   * 핵심 채번 로직 (SELECT FOR UPDATE → UPDATE → 패턴 치환)
   */
  private async generateNumber(
    qr: QueryRunner,
    ruleType: string,
    userId: string,
  ): Promise<string> {
    // 1) SELECT FOR UPDATE — 해당 규칙 행 잠금
    const rows: NumRule[] = await qr.query(
      `SELECT "PATTERN", "PREFIX", "SUFFIX", "SEQ_LENGTH",
              "CURRENT_SEQ", "RESET_TYPE", "LAST_RESET"
         FROM "NUM_RULE_MASTERS"
        WHERE "RULE_TYPE" = :1
          AND "USE_YN" = 'Y'
          AND "DELETED_AT" IS NULL
          FOR UPDATE`,
      [ruleType],
    );

    if (!rows || rows.length === 0) {
      throw new InternalServerErrorException(
        `채번 규칙 미등록: ${ruleType}`,
      );
    }

    const rule = rows[0];
    const now = new Date();

    // 2) 리셋 판단
    let needReset = false;
    if (rule.LAST_RESET) {
      const last = new Date(rule.LAST_RESET);
      switch (rule.RESET_TYPE) {
        case 'DAILY':
          needReset = last.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
          break;
        case 'MONTHLY':
          needReset = last.toISOString().slice(0, 7) !== now.toISOString().slice(0, 7);
          break;
        case 'YEARLY':
          needReset = last.getFullYear() !== now.getFullYear();
          break;
        // 'NONE': needReset stays false
      }
    }

    // 3) 시퀀스 계산
    const nextSeq = needReset ? 1 : rule.CURRENT_SEQ + 1;

    // 4) UPDATE
    await qr.query(
      `UPDATE "NUM_RULE_MASTERS"
          SET "CURRENT_SEQ" = :1,
              "LAST_RESET"  = SYSDATE,
              "UPDATED_BY"  = :2,
              "UPDATED_AT"  = SYSTIMESTAMP
        WHERE "RULE_TYPE" = :3
          AND "USE_YN" = 'Y'
          AND "DELETED_AT" IS NULL`,
      [nextSeq, userId, ruleType],
    );

    // 5) 패턴 치환
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const seq = String(nextSeq).padStart(rule.SEQ_LENGTH, '0');

    let result = rule.PATTERN;
    result = result.replace('{YYYY}', yyyy);
    result = result.replace('{YY}', yyyy.slice(2));
    result = result.replace('{MM}', mm);
    result = result.replace('{DD}', dd);
    result = result.replace('{SEQ}', seq);

    // PREFIX / SUFFIX (패턴에 {PREFIX}/{SUFFIX} 없으면 앞뒤에 직접 붙임)
    if (rule.PREFIX) {
      if (result.includes('{PREFIX}')) {
        result = result.replace('{PREFIX}', rule.PREFIX);
      } else {
        result = rule.PREFIX + result;
      }
    } else {
      result = result.replace('{PREFIX}', '');
    }

    if (rule.SUFFIX) {
      if (result.includes('{SUFFIX}')) {
        result = result.replace('{SUFFIX}', rule.SUFFIX);
      } else {
        result = result + rule.SUFFIX;
      }
    } else {
      result = result.replace('{SUFFIX}', '');
    }

    return result;
  }
}
