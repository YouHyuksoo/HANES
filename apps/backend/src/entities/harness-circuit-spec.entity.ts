import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'HARNESS_CIRCUIT_SPECS' })
@Index(['company', 'plant', 'revisionId', 'sortOrder'])
@Index(['company', 'plant', 'revisionId', 'circuitNo'], { unique: true })
export class HarnessCircuitSpec {
  @PrimaryColumn({ name: 'CIRCUIT_ID', type: 'number' })
  circuitId: number;

  @Column({ name: 'REVISION_ID', type: 'number' })
  revisionId: number;

  @Column({ name: 'SORT_ORDER', type: 'number', default: 0 })
  sortOrder: number;

  @Column({ name: 'CIRCUIT_NO', length: 50 })
  circuitNo: string;

  @Column({ type: 'varchar2', name: 'WIRE_SPEC', length: 100, nullable: true })
  wireSpec: string | null;

  @Column({ type: 'varchar2', name: 'WIRE_ITEM_CODE', length: 50, nullable: true })
  wireItemCode: string | null;

  @Column({ type: 'varchar2', name: 'WIRE_SIZE', length: 50, nullable: true })
  wireSize: string | null;

  @Column({ type: 'varchar2', name: 'COLOR_CODE', length: 30, nullable: true })
  colorCode: string | null;

  @Column({ type: 'varchar2', name: 'COLOR_NAME', length: 50, nullable: true })
  colorName: string | null;

  @Column({ name: 'LENGTH_MM', type: 'number', precision: 12, scale: 3, nullable: true })
  lengthMm: number | null;

  @Column({ name: 'STRIP_A_MM', type: 'number', precision: 8, scale: 3, nullable: true })
  stripA: number | null;

  @Column({ name: 'STRIP_B_MM', type: 'number', precision: 8, scale: 3, nullable: true })
  stripB: number | null;

  @Column({ type: 'varchar2', name: 'END_A_HOUSING', length: 100, nullable: true })
  endAHousing: string | null;

  @Column({ type: 'varchar2', name: 'END_A_TERMINAL', length: 100, nullable: true })
  endATerminal: string | null;

  @Column({ type: 'varchar2', name: 'CONNECTION_SYMBOL', length: 30, nullable: true })
  connectionSymbol: string | null;

  @Column({ type: 'varchar2', name: 'END_B_TERMINAL', length: 100, nullable: true })
  endBTerminal: string | null;

  @Column({ type: 'varchar2', name: 'END_B_HOUSING', length: 100, nullable: true })
  endBHousing: string | null;

  @Column({ type: 'varchar2', name: 'TUBE_SPEC', length: 100, nullable: true })
  tubeSpec: string | null;

  @Column({ type: 'varchar2', name: 'SUB_NO', length: 50, nullable: true })
  subNo: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 1000, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
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
