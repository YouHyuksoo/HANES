import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CONSUMABLE_LOGS' })
@Index(['consumableId'])
@Index(['logType'])
export class ConsumableLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'CONSUMABLE_ID', length: 50 })
  consumableId: string;

  @Column({ name: 'LOG_TYPE', length: 50 })
  logType: string;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

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

  @Column({ name: 'VENDOR_CODE', length: 50, nullable: true })
  vendorCode: string | null;

  @Column({ name: 'VENDOR_NAME', length: 100, nullable: true })
  vendorName: string | null;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'INCOMING_TYPE', length: 50, nullable: true })
  incomingType: string | null;

  @Column({ name: 'DEPARTMENT', length: 50, nullable: true })
  department: string | null;

  @Column({ name: 'LINE_ID', length: 50, nullable: true })
  lineId: string | null;

  @Column({ name: 'EQUIPMENT_ID', length: 50, nullable: true })
  equipId: string | null;

  @Column({ name: 'ISSUE_REASON', length: 200, nullable: true })
  issueReason: string | null;

  @Column({ name: 'RETURN_REASON', length: 200, nullable: true })
  returnReason: string | null;
}
