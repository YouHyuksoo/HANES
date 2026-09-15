/**
 * @file src/entities/iqc-request-lot.entity.ts
 * @description IQC 검사의뢰 LOT 헤더. 품목 1개 + 담당자가 묶은 입하 수량 모집단.
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'IQC_REQUEST_LOTS' })
@Index(['company', 'plant', 'itemCode', 'status'])
export class IqcRequestLot {
  @PrimaryColumn({ name: 'REQUEST_NO', length: 50 })
  requestNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ type: 'varchar2', name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string | null;

  @Column({ type: 'varchar2', name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  @Column({ type: 'varchar2', name: 'INVOICE_NO', length: 100, nullable: true })
  invoiceNo: string | null;

  @Column({ name: 'LOT_QTY', type: 'number' })
  lotQty: number;

  @Column({ name: 'SAMPLE_QTY', type: 'number', nullable: true })
  sampleQty: number | null;

  @Column({ name: 'STATUS', length: 20, default: 'REQUESTED' })
  status: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
