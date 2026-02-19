import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CUSTOMS_USAGE_REPORTS' })
@Index(['customsLotId'])
@Index(['status'])
@Index(['usageDate'])
export class CustomsUsageReport {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'REPORT_NO', length: 50, unique: true })
  reportNo: string;

  @Column({ name: 'CUSTOMS_LOT_ID', length: 255 })
  customsLotId: string;

  @Column({ name: 'JOB_ORDER_ID', length: 255, nullable: true })
  jobOrderId: string | null;

  @Column({ name: 'USAGE_QTY', type: 'int' })
  usageQty: number;

  @Column({ name: 'USAGE_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  usageDate: Date;

  @Column({ name: 'REPORT_DATE', type: 'timestamp', nullable: true })
  reportDate: Date | null;

  @Column({ name: 'STATUS', length: 50, default: 'DRAFT' })
  status: string;

  @Column({ name: 'WORKER_ID', length: 255, nullable: true })
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
}
