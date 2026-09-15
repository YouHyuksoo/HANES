/**
 * @file src/entities/iqc-request-lot-line.entity.ts
 * @description 검사의뢰 LOT 구성 입하. SAMPLE=시료, REPRESENTED=미검사 대표.
 *
 * 구성 대상은 MAT_ARRIVALS이고 그 PK는 복합키 (ARRIVAL_NO, SEQ)다.
 * ARRIVAL_NO 단독으로는 입하 행이 유일하지 않으므로 ARRIVAL_SEQ를 반드시 함께 보관한다.
 */
import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity({ name: 'IQC_REQUEST_LOT_LINES' })
@Index(['company', 'plant', 'arrivalNo', 'arrivalSeq', 'itemCode'])
export class IqcRequestLotLine {
  @PrimaryColumn({ name: 'REQUEST_NO', length: 50 })
  requestNo: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'ARRIVAL_NO', length: 50 })
  arrivalNo: string;

  /** MAT_ARRIVALS.SEQ. ARRIVAL_NO와 쌍으로 입하 행을 특정한다. */
  @Column({ name: 'ARRIVAL_SEQ', type: 'int', default: 1 })
  arrivalSeq: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'QTY', type: 'number' })
  qty: number;

  @Column({ name: 'LINE_ROLE', length: 20, default: 'REPRESENTED' })
  lineRole: 'SAMPLE' | 'REPRESENTED';

  @Column({ type: 'varchar2', name: 'INVOICE_NO', length: 100, nullable: true })
  invoiceNo: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;
}
