import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'HARNESS_DRAWING_MASTERS' })
@Index(['company', 'plant', 'drawingNo'], { unique: true })
@Index(['company', 'plant', 'itemCode'])
export class HarnessDrawingMaster {
  @PrimaryColumn({ name: 'DRAWING_ID', type: 'number' })
  drawingId: number;

  @Column({ name: 'DRAWING_NO', length: 100 })
  drawingNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ type: 'varchar2', name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string | null;

  @Column({ type: 'varchar2', name: 'ERP_ITEM_NO', length: 100, nullable: true })
  erpItemNo: string | null;

  @Column({ type: 'varchar2', name: 'CUSTOMER_PART_NO', length: 100, nullable: true })
  customerPartNo: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 1000, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
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
