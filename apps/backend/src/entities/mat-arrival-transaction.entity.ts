import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'MAT_ARRIVAL_TRANSACTIONS' })
@Index(['transType'])
@Index(['transDate'])
@Index(['warehouseCode'])
@Index(['itemCode'])
@Index(['matUid'])
@Index(['refType', 'refId'])
@Index(['cancelRefId'])
export class MatArrivalTransaction {
  @PrimaryColumn({ name: 'TRANS_NO', length: 50 })
  transNo: string;

  @Column({ name: 'TRANS_TYPE', length: 50 })
  transType: string;

  @Column({ name: 'TRANS_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transDate: Date;

  @Column({ type: 'varchar2', name: 'ARRIVAL_NO', length: 50, nullable: true })
  arrivalNo: string | null;

  @Column({ type: 'number', name: 'ARRIVAL_SEQ', nullable: true })
  arrivalSeq: number | null;

  @Column({ type: 'varchar2', name: 'WAREHOUSE_CODE', length: 50, nullable: true })
  warehouseCode: string | null;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'MAT_UID', length: 50 })
  matUid: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'TOTAL_AMOUNT', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ type: 'varchar2', name: 'REF_TYPE', length: 50, nullable: true })
  refType: string | null;

  @Column({ type: 'varchar2', name: 'REF_ID', length: 50, nullable: true })
  refId: string | null;

  @Column({ type: 'varchar2', name: 'CANCEL_REF_ID', length: 50, nullable: true })
  cancelRefId: string | null;

  @Column({ type: 'varchar2', name: 'WORKER_CODE', length: 50, nullable: true })
  workerId: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

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
