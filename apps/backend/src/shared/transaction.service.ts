/**
 * @file src/shared/transaction.service.ts
 * @description 트랜잭션 유틸리티 — QueryRunner 보일러플레이트 제거
 *
 * 초보자 가이드:
 * 1. **run(callback)**: 자동 트랜잭션 래핑 (connect → startTransaction → commit/rollback → release)
 * 2. 기존 패턴 6줄 → 1줄로 축소:
 *
 * Before:
 * ```typescript
 * const qr = this.dataSource.createQueryRunner();
 * await qr.connect();
 * await qr.startTransaction();
 * try {
 *   const result = await someLogic(qr);
 *   await qr.commitTransaction();
 *   return result;
 * } catch (err) {
 *   await qr.rollbackTransaction();
 *   throw err;
 * } finally {
 *   await qr.release();
 * }
 * ```
 *
 * After:
 * ```typescript
 * return this.tx.run(async (qr) => {
 *   return someLogic(qr);
 * });
 * ```
 */
import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class TransactionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 트랜잭션 내에서 콜백 실행
   * — 성공 시 자동 COMMIT, 실패 시 자동 ROLLBACK
   * @param callback QueryRunner를 받아 비즈니스 로직 수행
   * @returns 콜백 반환값
   */
  async run<T>(callback: (qr: QueryRunner) => Promise<T>): Promise<T> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const result = await callback(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
