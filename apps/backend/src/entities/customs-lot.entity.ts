import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CUSTOMS_LOTS' })
@Index(['ENTRY_ID'])
@Index(['LOT_NO'])
@Index(['STATUS'])
export class CustomsLot {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'ENTRY_ID', length: 255 })
  entryId: string;

  @Column({ name: 'LOT_NO', length: 100 })
  lotNo: string;

  @Column({ name: 'PART_CODE', length: 50 })
  partCode: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'USED_QTY', type: 'int', default: 0 })
  usedQty: number;

  @Column({ name: 'REMAIN_QTY', type: 'int', default: 0 })
  remainQty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'STATUS', length: 50, default: 'BONDED' })
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
}
