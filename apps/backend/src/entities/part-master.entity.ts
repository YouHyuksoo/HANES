import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PART_MASTERS' })
@Index(['PART_TYPE'])
@Index(['CUSTOMER'])
export class PartMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'PART_CODE', length: 50, unique: true })
  partCode: string;

  @Column({ name: 'PART_NAME', length: 100 })
  partName: string;

  @Column({ name: 'PART_NO', length: 50, nullable: true })
  partNo: string | null;

  @Column({ name: 'CUST_PART_NO', length: 50, nullable: true })
  custPartNo: string | null;

  @Column({ name: 'PART_TYPE', length: 50 })
  partType: string;

  @Column({ name: 'PRODUCT_TYPE', length: 50, nullable: true })
  productType: string | null;

  @Column({ name: 'SPEC', length: 255, nullable: true })
  spec: string | null;

  @Column({ name: 'REV', length: 20, nullable: true })
  rev: string | null;

  @Column({ name: 'UNIT', length: 20, default: 'EA' })
  unit: string;

  @Column({ name: 'DRAW_NO', length: 50, nullable: true })
  drawNo: string | null;

  @Column({ name: 'CUSTOMER', length: 50, nullable: true })
  customer: string | null;

  @Column({ name: 'VENDOR', length: 50, nullable: true })
  vendor: string | null;

  @Column({ name: 'LEAD_TIME', type: 'int', default: 0 })
  leadTime: number;

  @Column({ name: 'SAFETY_STOCK', type: 'int', default: 0 })
  safetyStock: number;

  @Column({ name: 'LOT_UNIT_QTY', type: 'int', nullable: true })
  lotUnitQty: number | null;

  @Column({ name: 'BOX_QTY', type: 'int', default: 0 })
  boxQty: number;

  @Column({ name: 'IQC_FLAG', length: 1, default: 'Y' })
  iqcYn: string;

  @Column({ name: 'TACT_TIME', type: 'int', default: 0 })
  tactTime: number;

  @Column({ name: 'EXPIRY_DATE', type: 'int', default: 0 })
  expiryDate: number;

  @Column({ name: 'REMARKS', length: 500, nullable: true })
  remark: string | null;

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
