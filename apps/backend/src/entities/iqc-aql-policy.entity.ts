import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'IQC_AQL_POLICIES' })
export class IqcAqlPolicy {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ type: 'varchar2', name: 'POLICY_CODE', length: 50 })
  policyCode: string;

  @Column({ type: 'varchar2', name: 'POLICY_NAME', length: 100 })
  policyName: string;

  @Column({ type: 'varchar2', name: 'INSPECTION_LEVEL', length: 20, nullable: true })
  inspectionLevel: string | null;

  @Column({ type: 'varchar2', name: 'MAJOR_AQL_CODE', length: 50, nullable: true })
  majorAqlCode: string | null;

  @Column({ type: 'varchar2', name: 'MINOR_AQL_CODE', length: 50, nullable: true })
  minorAqlCode: string | null;

  @Column({ type: 'varchar2', name: 'CRITICAL_MODE', length: 30, default: 'IMMEDIATE_FAIL' })
  criticalMode: string;

  @Column({ type: 'varchar2', name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
