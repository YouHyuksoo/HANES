import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'QUALITY_PFMEA_ROWS' })
@Index(['company', 'plant', 'revisionId', 'rowSeq'], { unique: true })
export class PfmeaRowEntity {
  @PrimaryColumn({ name: 'ROW_ID', type: 'number' }) rowId: number;
  @Column({ name: 'REVISION_ID', type: 'number' }) revisionId: number;
  @Column({ name: 'ROW_SEQ', type: 'number' }) rowSeq: number;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'PROCESS_FLOW_ROW_ID', type: 'number' }) processFlowRowId: number;
  @Column({ name: 'PROCESS_FUNCTION', type: 'varchar2', length: 500 }) processFunction: string;
  @Column({ name: 'REQUIREMENT', type: 'varchar2', length: 500 }) requirement: string;
  @Column({ name: 'FAILURE_MODE', type: 'varchar2', length: 1000 }) failureMode: string;
  @Column({ name: 'FAILURE_EFFECT', type: 'varchar2', length: 1000 }) failureEffect: string;
  @Column({ name: 'SEVERITY', type: 'number' }) severity: number;
  @Column({ name: 'SPECIAL_CHAR_CODE', type: 'varchar2', length: 30, nullable: true }) specialCharacteristicCode: string | null;
  @Column({ name: 'FAILURE_CAUSE', type: 'varchar2', length: 1000 }) failureCause: string;
  @Column({ name: 'PREVENTION_CONTROL', type: 'varchar2', length: 1000, nullable: true }) preventionControl: string | null;
  @Column({ name: 'OCCURRENCE', type: 'number' }) occurrence: number;
  @Column({ name: 'DETECTION_CONTROL', type: 'varchar2', length: 1000, nullable: true }) detectionControl: string | null;
  @Column({ name: 'DETECTION', type: 'number' }) detection: number;
  @Column({ name: 'RPN', type: 'number' }) rpn: number;
  @Column({ name: 'RECOMMENDED_ACTION', type: 'varchar2', length: 2000, nullable: true }) recommendedAction: string | null;
  @Column({ name: 'RESPONSIBLE_ORG', type: 'varchar2', length: 200, nullable: true }) responsibleOrganization: string | null;
  @Column({ name: 'RESPONSIBLE_PERSON', type: 'varchar2', length: 100, nullable: true }) responsiblePerson: string | null;
  @Column({ name: 'TARGET_DATE', type: 'date', nullable: true }) targetDate: Date | null;
  @Column({ name: 'COMPLETED_ACTION', type: 'varchar2', length: 2000, nullable: true }) completedAction: string | null;
  @Column({ name: 'COMPLETION_DATE', type: 'date', nullable: true }) completionDate: Date | null;
  @Column({ name: 'ACTION_SEVERITY', type: 'number', nullable: true }) actionSeverity: number | null;
  @Column({ name: 'ACTION_OCCURRENCE', type: 'number', nullable: true }) actionOccurrence: number | null;
  @Column({ name: 'ACTION_DETECTION', type: 'number', nullable: true }) actionDetection: number | null;
  @Column({ name: 'ACTION_RPN', type: 'number', nullable: true }) actionRpn: number | null;
  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 }) createdBy: string;
  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50, nullable: true }) updatedBy: string | null;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' }) updatedAt: Date;
}
