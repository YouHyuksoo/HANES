import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'QUALITY_PROCESS_FLOW_ROWS' })
@Index(['company', 'plant', 'revisionId', 'rowSeq'], { unique: true })
export class ProcessFlowRowEntity {
  @PrimaryColumn({ name: 'ROW_ID', type: 'number' }) rowId: number;
  @Column({ name: 'REVISION_ID', type: 'number' }) revisionId: number;
  @Column({ name: 'ROW_SEQ', type: 'number' }) rowSeq: number;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'PROCESS_NO', type: 'varchar2', length: 30 }) processNo: string;
  @Column({ name: 'PROCESS_CODE', type: 'varchar2', length: 50, nullable: true }) processCode: string | null;
  @Column({ name: 'PROCESS_NAME', type: 'varchar2', length: 200 }) processName: string;
  @Column({ name: 'EQUIPMENT_CODE', type: 'varchar2', length: 50, nullable: true }) equipmentCode: string | null;
  @Column({ name: 'EQUIPMENT_NAME', type: 'varchar2', length: 200, nullable: true }) equipmentName: string | null;
  @Column({ name: 'FLOW_LANE', type: 'varchar2', length: 20 }) flowLane: string;
  @Column({ name: 'FLOW_SYMBOL', type: 'varchar2', length: 30 }) flowSymbol: string;
  @Column({ name: 'PRODUCT_SPECIAL_CHAR', type: 'varchar2', length: 30, nullable: true }) productSpecialCharacteristic: string | null;
  @Column({ name: 'PROCESS_SPECIAL_CHAR', type: 'varchar2', length: 30, nullable: true }) processSpecialCharacteristic: string | null;
  @Column({ name: 'DESCRIPTION', type: 'varchar2', length: 1000, nullable: true }) description: string | null;
  @Column({ name: 'CREATED_BY', type: 'varchar2', length: 50 }) createdBy: string;
  @Column({ name: 'UPDATED_BY', type: 'varchar2', length: 50, nullable: true }) updatedBy: string | null;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' }) updatedAt: Date;
}
