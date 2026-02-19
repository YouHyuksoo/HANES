import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_LOTS' })
@Index(['partId'])
@Index(['status'])
@Index(['iqcStatus'])
export class MatLot {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'LOT_NO', length: 50, unique: true })
  lotNo: string;

  @Column({ name: 'PART_ID', length: 50 })
  partId: string;

  @Column({ name: 'INIT_QTY', type: 'int' })
  initQty: number;

  @Column({ name: 'CURRENT_QTY', type: 'int' })
  currentQty: number;

  @Column({ name: 'RECV_DATE', type: 'date', nullable: true })
  recvDate: Date | null;

  @Column({ name: 'EXPIRE_DATE', type: 'date', nullable: true })
  expireDate: Date | null;

  @Column({ name: 'ORIGIN', length: 50, nullable: true })
  origin: string | null;

  @Column({ name: 'VENDOR', length: 50, nullable: true })
  vendor: string | null;

  @Column({ name: 'INVOICE_NO', length: 50, nullable: true })
  invoiceNo: string | null;

  @Column({ name: 'PO_NO', length: 50, nullable: true })
  poNo: string | null;

  @Column({ name: 'IQC_STATUS', length: 20, default: 'PENDING' })
  iqcStatus: string;

  @Column({ name: 'STATUS', length: 20, default: 'NORMAL' })
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

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
