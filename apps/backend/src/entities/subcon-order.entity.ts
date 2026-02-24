import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'SUBCON_ORDERS' })
@Unique(['orderNo'])
@Index(['vendorId'])
@Index(['status'])
@Index(['orderDate'])
export class SubconOrder {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'ORDER_NO', length: 255, unique: true })
  orderNo: string;

  @Column({ name: 'VENDOR_ID', length: 255 })
  vendorId: string;

  @Column({ name: 'PART_CODE', length: 255 })
  partCode: string;

  @Column({ name: 'PART_NAME', length: 255, nullable: true })
  partName: string | null;

  @Column({ name: 'ORDER_QTY', type: 'int' })
  orderQty: number;

  @Column({ name: 'DELIVERED_QTY', type: 'int', default: 0 })
  deliveredQty: number;

  @Column({ name: 'RECEIVED_QTY', type: 'int', default: 0 })
  receivedQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'ORDER_DATE', type: 'date', nullable: true })
  orderDate: Date | null;

  @Column({ name: 'DUE_DATE', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'STATUS', length: 50, default: 'ORDERED' })
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

}
