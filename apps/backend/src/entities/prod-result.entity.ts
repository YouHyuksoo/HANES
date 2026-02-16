import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PROD_RESULTS' })
@Index(['JOB_ORDER_ID'])
@Index(['EQUIP_ID'])
@Index(['WORKER_ID'])
@Index(['STATUS'])
export class ProdResult {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'JOB_ORDER_ID', length: 255 })
  jobOrderId: string;

  @Column({ name: 'EQUIP_ID', length: 255, nullable: true })
  equipId: string | null;

  @Column({ name: 'WORKER_ID', length: 255, nullable: true })
  workerId: string | null;

  @Column({ name: 'LOT_NO', length: 255, nullable: true })
  lotNo: string | null;

  @Column({ name: 'PROCESS_CODE', length: 255, nullable: true })
  processCode: string | null;

  @Column({ name: 'GOOD_QTY', type: 'int', default: 0 })
  goodQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'START_TIME', type: 'timestamp', nullable: true })
  startAt: Date | null;

  @Column({ name: 'END_TIME', type: 'timestamp', nullable: true })
  endAt: Date | null;

  @Column({ name: 'CYCLE_TIME', type: 'decimal', precision: 10, scale: 4, nullable: true })
  cycleTime: number | null;

  @Column({ name: 'STATUS', length: 50, default: 'RUNNING' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
