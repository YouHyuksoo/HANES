/**
 * @file src/entities/iqc-request-lot-line.entity.ts
 * @description 검사의뢰 LOT 구성 입하. SAMPLE=시료, REPRESENTED=미검사 대표.
 */
import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity({ name: 'IQC_REQUEST_LOT_LINES' })
@Index(['company', 'plant', 'arrivalNo', 'itemCode'])
export class IqcRequestLotLine {
  @PrimaryColumn({ name: 'REQUEST_NO', length: 50 })
  requestNo: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'ARRIVAL_NO', length: 50 })
  arrivalNo: string;

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
