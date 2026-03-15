/**
 * @file entities/customs-usage-report.entity.ts
 * @description 보세 사용 보고서 엔티티 - 보세자재 사용 실적을 관리한다.
 *              REPORT_NO 자연키 PK 사용.
 *
 * 초보자 가이드:
 * 1. reportNo가 자연키 PK (보고서 번호)
 * 2. lotEntryNo + lotMatUid: 보세 LOT 복합키 참조
 * 3. status: DRAFT, SUBMITTED, APPROVED 등
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CUSTOMS_USAGE_REPORTS' })
@Index(['lotEntryNo', 'lotMatUid'])
@Index(['status'])
@Index(['usageDate'])
export class CustomsUsageReport {
  @PrimaryColumn({ name: 'REPORT_NO', length: 50 })
  reportNo: string;

  @Column({ name: 'LOT_ENTRY_NO', length: 50 })
  lotEntryNo: string;

  @Column({ name: 'LOT_MAT_UID', length: 100 })
  lotMatUid: string;

  @Column({ name: 'ORDER_NO', length: 36, nullable: true })
  jobOrderId: string | null;

  @Column({ name: 'USAGE_QTY', type: 'int' })
  usageQty: number;

  @Column({ name: 'USAGE_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  usageDate: Date;

  @Column({ name: 'REPORT_DATE', type: 'timestamp', nullable: true })
  reportDate: Date | null;

  @Column({ name: 'STATUS', length: 50, default: 'DRAFT' })
  status: string;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
