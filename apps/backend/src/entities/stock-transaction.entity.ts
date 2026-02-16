import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'STOCK_TRANSACTIONS' })
@Index(['TRANS_TYPE'])
@Index(['TRANS_DATE'])
@Index(['FROM_WAREHOUSE_ID'])
@Index(['TO_WAREHOUSE_ID'])
@Index(['PART_ID'])
@Index(['LOT_ID'])
@Index(['REF_TYPE', 'REF_ID'])
@Index(['CANCEL_REF_ID'])
export class StockTransaction {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'TRANS_NO', length: 50, unique: true })
  transNo: string;

  @Column({ name: 'TRANS_TYPE', length: 50 })
  transType: string;

  @Column({ name: 'TRANS_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  transDate: Date;

  @Column({ name: 'FROM_WAREHOUSE_ID', length: 50, nullable: true })
  fromWarehouseId: string | null;

  @Column({ name: 'TO_WAREHOUSE_ID', length: 50, nullable: true })
  toWarehouseId: string | null;

  @Column({ name: 'PART_ID', length: 50 })
  partId: string;

  @Column({ name: 'LOT_ID', length: 50, nullable: true })
  lotId: string | null;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'TOTAL_AMOUNT', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ name: 'REF_TYPE', length: 50, nullable: true })
  refType: string | null;

  @Column({ name: 'REF_ID', length: 50, nullable: true })
  refId: string | null;

  @Column({ name: 'CANCEL_REF_ID', length: 50, nullable: true })
  cancelRefId: string | null;

  @Column({ name: 'WORKER_ID', length: 50, nullable: true })
  workerId: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DONE' })
  status: string;

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
