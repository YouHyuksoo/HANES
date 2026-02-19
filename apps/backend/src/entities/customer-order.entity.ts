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

@Entity({ name: 'CUSTOMER_ORDERS' })
@Unique(['orderNo'])
@Index(['status'])
@Index(['orderDate'])
@Index(['customerId'])
export class CustomerOrder {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'ORDER_NO', length: 50, unique: true })
  orderNo: string;

  @Column({ name: 'CUSTOMER_ID', length: 255, nullable: true })
  customerId: string | null;

  @Column({ name: 'CUSTOMER_NAME', length: 100, nullable: true })
  customerName: string | null;

  @Column({ name: 'ORDER_DATE', type: 'date', default: () => 'CURRENT_DATE' })
  orderDate: Date;

  @Column({ name: 'DUE_DATE', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'STATUS', length: 50, default: 'RECEIVED' })
  status: string;

  @Column({ name: 'TOTAL_AMOUNT', type: 'decimal', precision: 15, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ name: 'CURRENCY', length: 10, default: 'KRW' })
  currency: string;

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
