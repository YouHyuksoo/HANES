import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'QUALITY_PLAN_VALIDATIONS' })
@Index(['company', 'plant', 'revisionId'])
export class QualityPlanValidationEntity {
  @PrimaryColumn({ name: 'VALIDATION_ID', type: 'number' }) validationId: number;
  @Column({ name: 'REVISION_ID', type: 'number' }) revisionId: number;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'IS_VALID', type: 'char', length: 1 }) isValid: string;
  @Column({ name: 'ERROR_COUNT', type: 'number', default: 0 }) errorCount: number;
  @Column({ name: 'WARNING_COUNT', type: 'number', default: 0 }) warningCount: number;
  @Column({ name: 'ISSUES_JSON', type: 'clob' }) issuesJson: string;
  @Column({ name: 'VALIDATED_BY', type: 'varchar2', length: 50 }) validatedBy: string;
  @CreateDateColumn({ name: 'VALIDATED_AT', type: 'timestamp' }) validatedAt: Date;
}
