import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'INV_ADJ_LOGS' })
@Index(['WAREHOUSE_CODE'])
@Index(['PART_ID'])
@Index(['ADJ_TYPE'])
export class InvAdjLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @Column({ name: 'PART_ID', length: 50 })
  partId: string;

  @Column({ name: 'LOT_ID', length: 50, nullable: true })
  lotId: string | null;

  @Column({ name: 'ADJ_TYPE', length: 50 })
  adjType: string;

  @Column({ name: 'BEFORE_QTY', type: 'int' })
  beforeQty: number;

  @Column({ name: 'AFTER_QTY', type: 'int' })
  afterQty: number;

  @Column({ name: 'DIFF_QTY', type: 'int' })
  diffQty: number;

  @Column({ name: 'REASON', length: 500, nullable: true })
  reason: string | null;

  @Column({ name: 'APPROVED_BY', length: 50, nullable: true })
  approvedBy: string | null;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
