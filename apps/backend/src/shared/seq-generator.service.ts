/**
 * @file seq-generator.service.ts
 * @description 통합 채번 서비스 - Oracle PKG_SEQ_GENERATOR.GET_NO() 호출
 *
 * 초보자 가이드:
 * 1. getNo(docType): 문서유형별 번호 채번 (MAT_UID, FG_BARCODE, JOB_ORDER 등)
 * 2. Oracle 패키지가 SEQ_RULES 테이블에서 규칙 조회 → 시퀀스 + 접두어 + 날짜 조합
 * 3. 트랜잭션 내 호출 시 QueryRunner 전달
 */
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class SeqGeneratorService {
  private readonly logger = new Logger(SeqGeneratorService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** 통합 채번: PKG_SEQ_GENERATOR.GET_NO 호출 */
  async getNo(docType: string, qr?: QueryRunner): Promise<string> {
    const manager = qr?.manager ?? this.dataSource.manager;
    try {
      const result = await manager.query(
        `SELECT PKG_SEQ_GENERATOR.GET_NO(:1) AS "no" FROM DUAL`,
        [docType],
      );
      return result[0].no;
    } catch (error: any) {
      this.logger.error(`채번 실패 (${docType}): ${error.message}`);
      throw new InternalServerErrorException(
        `채번 실패 (${docType}): SEQ_RULES에 규칙이 등록되어 있는지 확인하세요.`,
      );
    }
  }

  // 하위호환 편의 메서드
  async nextMatUid(qr?: QueryRunner): Promise<string> { return this.getNo('MAT_UID', qr); }
  async nextPrdUid(qr?: QueryRunner): Promise<string> { return this.getNo('PRD_UID', qr); }
  async nextConUid(qr?: QueryRunner): Promise<string> { return this.getNo('CON_UID', qr); }
  async nextFgBarcode(qr?: QueryRunner): Promise<string> { return this.getNo('FG_BARCODE', qr); }
  async nextJobOrderNo(qr?: QueryRunner): Promise<string> { return this.getNo('JOB_ORDER', qr); }
  async nextOqcReqNo(qr?: QueryRunner): Promise<string> { return this.getNo('OQC_REQ', qr); }
  async nextMatReqNo(qr?: QueryRunner): Promise<string> { return this.getNo('MAT_REQ', qr); }
  async nextArrivalNo(qr?: QueryRunner): Promise<string> { return this.getNo('ARRIVAL', qr); }
  async nextShipmentNo(qr?: QueryRunner): Promise<string> { return this.getNo('SHIPMENT', qr); }
  async nextSubconNo(qr?: QueryRunner): Promise<string> { return this.getNo('SUBCON', qr); }
  async nextProdResultNo(qr?: QueryRunner): Promise<string> { return this.getNo('PROD_RESULT', qr); }
  async nextInspectResultNo(qr?: QueryRunner): Promise<string> { return this.getNo('INSPECT_RESULT', qr); }
}
