import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'QUALITY_CONTROL_PLAN_ROWS' })
@Index(['company', 'plant', 'revisionId', 'rowSeq'], { unique: true })
export class QualityControlPlanRowEntity {
  @PrimaryColumn({ name: 'ROW_ID', type: 'number' }) rowId: number;
  @Column({ name: 'REVISION_ID', type: 'number' }) revisionId: number;
  @Column({ name: 'ROW_SEQ', type: 'number' }) rowSeq: number;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'PROCESS_FLOW_ROW_ID', type: 'number' }) processFlowRowId: number;
  @Column({ name: 'PFMEA_ROW_ID', type: 'number', nullable: true }) pfmeaRowId: number | null;
  @Column({ name: 'PROCESS_NO', type: 'varchar2', length: 30 }) processNo: string;
  @Column({ name: 'PROCESS_NAME', type: 'varchar2', length: 200 }) processName: string;
  @Column({ name: 'EQUIPMENT_CODE', type: 'varchar2', length: 50, nullable: true }) equipmentCode: string | null;
  @Column({ name: 'EQUIPMENT_NAME', type: 'varchar2', length: 200, nullable: true }) equipmentName: string | null;
  @Column({ name: 'CHARACTERISTIC_NO', type: 'varchar2', length: 30, nullable: true }) characteristicNo: string | null;
  @Column({ name: 'PRODUCT_CHARACTERISTIC', type: 'varchar2', length: 500, nullable: true }) productCharacteristic: string | null;
  @Column({ name: 'PROCESS_CHARACTERISTIC', type: 'varchar2', length: 500, nullable: true }) processCharacteristic: string | null;
  @Column({ name: 'SPECIAL_CHAR_CODE', type: 'varchar2', length: 30, nullable: true }) specialCharacteristicCode: string | null;
  @Column({ name: 'SPECIFICATION', type: 'varchar2', length: 1000 }) specification: string;
  @Column({ name: 'EVALUATION_METHOD', type: 'varchar2', length: 500 }) evaluationMethod: string;
  @Column({ name: 'SAMPLE_SIZE', type: 'varchar2', length: 50 }) sampleSize: string;
  @Column({ name: 'SAMPLE_FREQUENCY', type: 'varchar2', length: 100, nullable: true }) sampleFrequency: string | null;
  @Column({ name: 'CONTROL_METHOD', type: 'varchar2', length: 1000 }) controlMethod: string;
  @Column({ name: 'RESPONSIBLE_ROLE', type: 'varchar2', length: 100, nullable: true }) responsibleRole: string | null;
  @Column({ name: 'REACTION_PLAN', type: 'varchar2', length: 2000 }) reactionPlan: string;
  @Column({ name: 'RECORD_FORM', type: 'varchar2', length: 500, nullable: true }) recordForm: string | null;
  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 }) createdBy: string;
  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50, nullable: true }) updatedBy: string | null;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' }) updatedAt: Date;
}
