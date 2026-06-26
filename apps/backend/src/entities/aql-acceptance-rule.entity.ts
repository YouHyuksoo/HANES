import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'AQL_ACCEPTANCE_RULES' })
export class AqlAcceptanceRule {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ type: 'varchar2', name: 'INSPECTION_MODE', length: 20 })
  inspectionMode: string;

  @PrimaryColumn({ type: 'varchar2', name: 'CODE_LETTER', length: 5 })
  codeLetter: string;

  @PrimaryColumn({ type: 'number', name: 'AQL_VALUE', precision: 8, scale: 3 })
  aqlValue: number;

  @Column({ type: 'varchar2', name: 'SAMPLE_CODE_LETTER', length: 5 })
  sampleCodeLetter: string;

  @Column({ type: 'number', name: 'ACCEPT_QTY' })
  acceptQty: number;

  @Column({ type: 'number', name: 'REJECT_QTY' })
  rejectQty: number;

  @Column({ type: 'number', name: 'SORT_ORDER', nullable: true })
  sortOrder: number | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
