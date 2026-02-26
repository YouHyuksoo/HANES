/**
 * @file entities/customs-usage-report.entity.ts
 * @description 보세 사용 보고서 엔티티 - 보세자재 사용 실적을 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. reportNo: 보고서 번호 (유니크)
 * 3. customsLotId: 보세 LOT ID 참조 (number)
 * 4. status: DRAFT, SUBMITTED, APPROVED 등
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CUSTOMS_USAGE_REPORTS' })
@Index(['customsLotId'])
@Index(['status'])
@Index(['usageDate'])
export class CustomsUsageReport {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'REPORT_NO', length: 50, unique: true })
  reportNo: string;

  @Column({ name: 'CUSTOMS_LOT_ID', type: 'number' })
  customsLotId: number;

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
  workerCode: string | null;

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
