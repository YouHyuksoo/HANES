import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'WAREHOUSES' })
@Index(['warehouseType'])
@Index(['plantCode'])
@Index(['lineCode'])
export class Warehouse {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'WAREHOUSE_CODE', length: 50, unique: true })
  warehouseCode: string;

  @Column({ name: 'WAREHOUSE_NAME', length: 100 })
  warehouseName: string;

  @Column({ name: 'WAREHOUSE_TYPE', length: 50 })
  warehouseType: string;

  @Column({ name: 'PLANT_CODE', length: 50, nullable: true })
  plantCode: string | null;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string | null;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'VENDOR_ID', length: 50, nullable: true })
  vendorId: string | null;

  @Column({ name: 'IS_DEFAULT', type: 'char', length: 1, default: 'N' })
  isDefault: string;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
