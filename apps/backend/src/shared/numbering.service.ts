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
import { DataSource, QueryRunner } from 'typeorm';
import { SeqGeneratorService } from './seq-generator.service';
import { NumRuleService } from '../modules/num-rule/num-rule.service';

/** PKG_SEQ_GENERATOR로 처리되는 채번 유형 */
const SEQ_TYPES = new Set([
  'MAT_UID', 'PRD_UID', 'CON_UID', 'FG_BARCODE',
  'JOB_ORDER', 'OQC_REQ', 'MAT_REQ', 'SHIPMENT',
  'SUBCON', 'INSPECT_RESULT', 'PROD_RESULT',
  'TRAINING_PLAN',
]);

/** NUM_RULE_MASTERS로 처리되는 채번 유형 */
const RULE_TYPES = new Set([
  'ARRIVAL', 'RECEIVING', 'MAT_ISSUE',
  'SCRAP', 'RECEIPT_CANCEL', 'ISSUE_REQUEST',
  'STOCK_TX', 'CANCEL_TX', 'RECEIVE',
]);

@Injectable()
export class NumberingService {
  private readonly logger = new Logger(NumberingService.name);

  constructor(
    private readonly seqGenerator: SeqGeneratorService,
    private readonly numRule: NumRuleService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 통합 채번 — 유형에 따라 적절한 메커니즘 자동 선택
   * @param type 채번 유형 (MAT_UID, ARRIVAL, JOB_ORDER 등)
   * @param qr 트랜잭션 QueryRunner (선택)
   * @param userId 사용자ID (NUM_RULE 방식에서 사용, 기본 SYSTEM)
   */
  async next(type: string, qr?: QueryRunner, userId?: string): Promise<string> {
    // 공정 거래번호(WIP_TX): 전용 Oracle SEQUENCE(SEQ_WIP_TX) 기반 애플리케이션 포맷 채널
    if (type === 'WIP_TX') {
      return this.nextWipTx(qr);
    }

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
  async nextFgBarcode(qr?: QueryRunner): Promise<string> { return this.next('FG_BARCODE', qr); }
  async nextSubconNo(qr?: QueryRunner): Promise<string> { return this.next('SUBCON', qr); }
  async nextShipmentNo(qr?: QueryRunner): Promise<string> { return this.next('SHIPMENT', qr); }
  async nextTrainingPlanNo(qr?: QueryRunner): Promise<string> { return this.next('TRAINING_PLAN', qr); }

  // ─────────────────────────────────────────────
  // IQC005 Phase A — application-level format channels
  // PKG_SEQ_GENERATOR가 SEPARATOR를 PREFIX/DATE 양쪽 모두에 적용하는 제약을 우회한다.
  // 신규 Oracle SEQUENCE (SEQ_MAT_SERIAL_DAILY / SEQ_ARRIVAL_NO_DAILY)를 직접 호출하고
  // PDF 채번 규칙 (docs/standards/numbering-rules.md) 포맷을 코드에서 조립한다.
  // 시퀀스 일별 리셋은 DBMS_SCHEDULER JOB_RESET_*_DAILY 잡이 매일 00:00 KST 처리.
  // ─────────────────────────────────────────────

  /** 자재 시리얼 채번: VH1-RM + YYMMDD + 5자리(당일 시퀀스). PDF 2026-05-19. */
  async nextMatSerial(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_MAT_SERIAL_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `VH1-RM${this.yyMMdd(txDate)}-${this.pad5(seq)}`;
  }

  /** 구매발주번호 채번: PO-YYMMDD-NNN (3자리 순환, 1~999 CYCLE). */
  async nextPoNo(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_PO_NO_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `PO-${this.yyMMdd(txDate)}-${String(seq).padStart(3, '0')}`;
  }

  /** 입하실적코드 채번: R + YYMMDD + 5자리(당일 시퀀스, separator 없음). PDF 2026-05-19. */
  async nextArrivalNoV2(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_ARRIVAL_NO_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `R${this.yyMMdd(txDate)}${this.pad5(seq)}`;
  }

  /** 박스번호 채번: BX + YYMMDD + 4자리(당일 시퀀스, separator 없음). numbering-rules.md 3장. */
  async nextBoxNo(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_BOX_NO_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `BX${this.yyMMdd(txDate)}${this.pad4(seq)}`;
  }

  /**
   * 공정 거래번호 채번: WTX + YYMMDD + '-' + 5자리(전역 시퀀스).
   * - STOCK_TX(`TX{YYYYMMDD}-{SEQ5}`)와 시각적으로 일관된 포맷.
   * - SEQ_WIP_TX는 일별 리셋 없는 전역 시퀀스(NOCACHE)이므로 날짜는 가독성용,
   *   유일성은 시퀀스가 보장. 결번 없는 거래원장 채번에 사용.
   */
  async nextWipTx(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_WIP_TX.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `WTX${this.yyMMdd(txDate)}-${this.pad5(seq)}`;
  }

  /** 팔레트번호 채번: PLT + YYMMDD + 4자리(당일 시퀀스, separator 없음). 박스(BX) 채번과 동일 패턴. */
  async nextPalletNo(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_PALLET_NO_DAILY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `PLT${this.yyMMdd(txDate)}${this.pad4(seq)}`;
  }

  /** 반제품 묶음 추적라벨 채번: SG + YYMMDD + '-' + 5자리(전역 시퀀스 SEQ_SG_LABEL). 날짜는 가독성용, 유일성은 시퀀스 보장. */
  async nextSgLabel(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_SG_LABEL.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `SG${this.yyMMdd(txDate)}-${this.pad5(seq)}`;
  }

  /** 출하반품/취소이력 채번: RT + YYMMDD + '-' + 5자리(전역 시퀀스 SEQ_SHIP_RETURN). 날짜는 가독성용, 유일성은 시퀀스 보장. */
  async nextReturnNo(qr?: QueryRunner, txDate: Date = new Date()): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_SHIP_RETURN.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const seq = Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
    return `RT${this.yyMMdd(txDate)}-${this.pad5(seq)}`;
  }

  /** 생산 genealogy ID 채번: SEQ_PROD_GENEALOGY.NEXTVAL (PRODUCT_GENEALOGY.GENEALOGY_ID용). */
  async nextGenealogyId(qr?: QueryRunner): Promise<number> {
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows = await manager.query(
      'SELECT SEQ_PROD_GENEALOGY.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    return Number(rows[0]?.NEXT_SEQ ?? rows[0]?.next_seq ?? 0);
  }

  /**
   * 생산 genealogy ID 일괄 채번 — N개를 1회 round-trip으로 확보(N+1 제거).
   * 시퀀스 NEXTVAL을 인라인 뷰(CONNECT BY LEVEL) 바깥에서 호출하는 Oracle 안전 idiom 사용
   * (NEXTVAL을 CONNECT BY 절에 직접 두면 ORA-02287 발생 가능).
   * @returns 길이 count의 순차 ID 배열 (count<=0이면 빈 배열)
   */
  async nextGenealogyIds(qr: QueryRunner | undefined, count: number): Promise<number[]> {
    if (count <= 0) return [];
    const manager = qr?.manager ?? this.dataSource.manager;
    const rows: Array<{ NEXT_SEQ?: number; next_seq?: number }> = await manager.query(
      `SELECT SEQ_PROD_GENEALOGY.NEXTVAL AS "NEXT_SEQ"
         FROM (SELECT LEVEL AS L FROM DUAL CONNECT BY LEVEL <= :1)`,
      [count],
    );
    return rows.map((r) => Number(r.NEXT_SEQ ?? r.next_seq ?? 0));
  }

  private yyMMdd(d: Date): string {
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }

  private pad5(n: number): string {
    return String(n).padStart(5, '0');
  }

  private pad4(n: number): string {
    return String(n).padStart(4, '0');
  }
}
