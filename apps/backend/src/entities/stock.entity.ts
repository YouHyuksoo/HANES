import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'STOCKS' })
@Unique(['WAREHOUSE_ID', 'PART_ID', 'LOT_ID'])
@Index(['WAREHOUSE_ID'])
@Index(['PART_ID'])
@Index(['LOT_ID'])
export class Stock {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'WAREHOUSE_ID', length: 50 })
  warehouseId: string;

  @Column({ name: 'PART_ID', length: 50 })
  partId: string;

  @Column({ name: 'LOT_ID', length: 50, nullable: true })
  lotId: string | null;

  @Column({ name: 'QTY', type: 'int', default: 0 })
  qty: number;

  @Column({ name: 'RESERVED_QTY', type: 'int', default: 0 })
  reservedQty: number;

  @Column({ name: 'AVAILABLE_QTY', type: 'int', default: 0 })
  availableQty: number;

  @Column({ name: 'LAST_TRANS_AT', type: 'timestamp', nullable: true })
  lastTransAt: Date | null;

  @Column({ name: 'LAST_COUNT_AT', type: 'timestamp', nullable: true })
  lastCountAt: Date | null;

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
