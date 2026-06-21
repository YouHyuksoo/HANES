import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DefectGrade = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type DefectScope = 'RAW_MATERIAL' | 'PRODUCT' | 'PROCESS' | 'COMMON';

@Entity({ name: 'DEFECT_CODE_MASTERS' })
@Index(['company', 'plant', 'categoryCode'])
@Index(['company', 'plant', 'defectGrade'])
@Index(['company', 'plant', 'defectScope'])
export class DefectCodeMaster {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ type: 'varchar2', name: 'DEFECT_CODE', length: 50 })
  defectCode: string;

  @Column({ type: 'varchar2', name: 'DEFECT_NAME', length: 100 })
  defectName: string;

  @Column({ type: 'varchar2', name: 'CATEGORY_CODE', length: 50 })
  categoryCode: string;

  @Column({ type: 'varchar2', name: 'DEFECT_GRADE', length: 20 })
  defectGrade: DefectGrade;

  @Column({ type: 'varchar2', name: 'DEFECT_SCOPE', length: 30, default: 'COMMON' })
  defectScope: DefectScope;

  @Column({ type: 'varchar2', name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'number', name: 'SORT_ORDER', precision: 8, scale: 0, default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar2', name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
