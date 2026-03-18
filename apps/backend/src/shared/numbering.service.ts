/**
 * @file src/shared/numbering.service.ts
 * @description 통합 채번 파사드 — SeqGeneratorService + NumRuleService를 단일 인터페이스로 제공
 *
 * 초보자 가이드:
 * 1. **next(type, qr?)** → 채번 유형에 따라 적절한 메커니즘 자동 선택
 *    - SEQ_TYPES (PKG_SEQ_GENERATOR 기반): MAT_UID, PRD_UID, CON_UID, JOB_ORDER 등
 *    - RULE_TYPES (NUM_RULE_MASTERS 기반): ARRIVAL, MAT_ISSUE, PROD_RESULT 등
 * 2. **nextInTx(qr, type, userId?)** → 외부 트랜잭션 내에서 채번 (결번 없음)
 * 3. 신규 코드에서는 이 서비스만 주입하면 됨
 *
 * 기존 SeqGeneratorService/NumRuleService는 하위호환을 위해 유지됨
 */
import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { SeqGeneratorService } from './seq-generator.service';
import { NumRuleService } from '../modules/num-rule/num-rule.service';

/** PKG_SEQ_GENERATOR로 처리되는 채번 유형 */
const SEQ_TYPES = new Set([
  'MAT_UID', 'PRD_UID', 'CON_UID', 'FG_BARCODE',
  'JOB_ORDER', 'OQC_REQ', 'MAT_REQ', 'SHIPMENT',
  'SUBCON', 'INSPECT_RESULT',
]);

/** NUM_RULE_MASTERS로 처리되는 채번 유형 */
const RULE_TYPES = new Set([
  'ARRIVAL', 'RECEIVING', 'MAT_ISSUE', 'PROD_RESULT',
  'SCRAP', 'RECEIPT_CANCEL', 'ISSUE_REQUEST',
]);

@Injectable()
export class NumberingService {
  private readonly logger = new Logger(NumberingService.name);

  constructor(
    private readonly seqGenerator: SeqGeneratorService,
    private readonly numRule: NumRuleService,
  ) {}

  /**
   * 통합 채번 — 유형에 따라 적절한 메커니즘 자동 선택
   * @param type 채번 유형 (MAT_UID, ARRIVAL, JOB_ORDER 등)
   * @param qr 트랜잭션 QueryRunner (선택)
   * @param userId 사용자ID (NUM_RULE 방식에서 사용, 기본 SYSTEM)
   */
  async next(type: string, qr?: QueryRunner, userId?: string): Promise<string> {
    if (SEQ_TYPES.has(type)) {
      return this.seqGenerator.getNo(type, qr);
    }

    if (RULE_TYPES.has(type)) {
      return qr
        ? this.numRule.nextNumberInTx(qr, type, userId)
        : this.numRule.nextNumber(type, userId);
    }

    // 알 수 없는 유형 → SEQ_GENERATOR에 위임 (확장 가능)
    this.logger.warn(`알 수 없는 채번 유형: ${type} — SEQ_GENERATOR로 위임`);
    return this.seqGenerator.getNo(type, qr);
  }

  /**
   * 트랜잭션 내 채번 (외부 QueryRunner 필수)
   * — NUM_RULE 방식: 결번 없음 (외부 TX 참여)
   * — SEQ 방식: QueryRunner 전달
   */
  async nextInTx(qr: QueryRunner, type: string, userId?: string): Promise<string> {
    return this.next(type, qr, userId);
  }

  // ─────────────────────────────────────────────
  // 편의 메서드 (자주 사용되는 채번 유형)
  // ─────────────────────────────────────────────
  async nextMatUid(qr?: QueryRunner): Promise<string> { return this.next('MAT_UID', qr); }
  async nextPrdUid(qr?: QueryRunner): Promise<string> { return this.next('PRD_UID', qr); }
  async nextConUid(qr?: QueryRunner): Promise<string> { return this.next('CON_UID', qr); }
  async nextJobOrderNo(qr?: QueryRunner): Promise<string> { return this.next('JOB_ORDER', qr); }
  async nextArrivalNo(qr?: QueryRunner, userId?: string): Promise<string> { return this.next('ARRIVAL', qr, userId); }
  async nextProdResultNo(qr?: QueryRunner, userId?: string): Promise<string> { return this.next('PROD_RESULT', qr, userId); }
}
