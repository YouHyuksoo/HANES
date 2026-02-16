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

@Entity({ name: 'WAREHOUSE_TRANSFER_RULES' })
@Unique(['FROM_WAREHOUSE_ID', 'TO_WAREHOUSE_ID'])
@Index(['FROM_WAREHOUSE_ID'])
@Index(['TO_WAREHOUSE_ID'])
export class WarehouseTransferRule {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'FROM_WAREHOUSE_ID', length: 50 })
  fromWarehouseId: string;

  @Column({ name: 'TO_WAREHOUSE_ID', length: 50 })
  toWarehouseId: string;

  @Column({ name: 'ALLOW_YN', length: 1, default: 'Y' })
  allowYn: string;

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

  @DeleteDateColumn({ name: 'DELETED_AT', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
