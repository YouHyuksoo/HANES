import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'DEFECT_CATEGORY_MASTERS' })
@Index(['company', 'plant', 'parentCategoryCode'])
export class DefectCategoryMaster {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ type: 'varchar2', name: 'CATEGORY_CODE', length: 50 })
  categoryCode: string;

  @Column({ type: 'varchar2', name: 'CATEGORY_NAME', length: 100 })
  categoryName: string;

  @Column({ type: 'number', name: 'LEVEL_NO', precision: 1, scale: 0 })
  levelNo: number;

  @Column({ type: 'varchar2', name: 'PARENT_CATEGORY_CODE', length: 50, nullable: true })
  parentCategoryCode: string | null;

  @Column({ type: 'number', name: 'SORT_ORDER', precision: 8, scale: 0, default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar2', name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
