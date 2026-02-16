import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'JOB_ORDERS' })
@Unique(['ORDER_NO'])
@Index(['STATUS'])
@Index(['PLAN_DATE'])
@Index(['LINE_CODE'])
export class JobOrder {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'ORDER_NO', length: 255, unique: true })
  orderNo: string;

  @Column({ name: 'PART_ID', length: 255 })
  partId: string;

  @Column({ name: 'LINE_CODE', length: 255, nullable: true })
  lineCode: string | null;

  @Column({ name: 'PLAN_QTY', type: 'int' })
  planQty: number;

  @Column({ name: 'GOOD_QTY', type: 'int', default: 0 })
  goodQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'PLAN_DATE', type: 'date', nullable: true })
  planDate: Date | null;

  @Column({ name: 'START_TIME', type: 'timestamp', nullable: true })
  startAt: Date | null;

  @Column({ name: 'END_TIME', type: 'timestamp', nullable: true })
  endAt: Date | null;

  @Column({ name: 'PRIORITY', type: 'int', default: 5 })
  priority: number;

  @Column({ name: 'STATUS', length: 50, default: 'WAITING' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'ERP_SYNC_YN', length: 1, default: 'N' })
  erpSyncYn: string;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
