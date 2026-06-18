import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HarnessDrawingRevisionStatus = 'DRAFT' | 'APPROVED' | 'OBSOLETE';

@Entity({ name: 'HARNESS_DRAWING_REVISIONS' })
@Index(['company', 'plant', 'drawingId', 'revisionCode'], { unique: true })
@Index(['company', 'plant', 'status'])
export class HarnessDrawingRevision {
  @PrimaryColumn({ name: 'REVISION_ID', type: 'number' })
  revisionId: number;

  @Column({ name: 'DRAWING_ID', type: 'number' })
  drawingId: number;

  @Column({ name: 'REVISION_CODE', length: 20 })
  revisionCode: string;

  @Column({ name: 'STATUS', length: 20, default: 'DRAFT' })
  status: HarnessDrawingRevisionStatus;

  @Column({ name: 'EFFECTIVE_FROM', type: 'date', nullable: true })
  effectiveFrom: Date | null;

  @Column({ type: 'varchar2', name: 'CHANGE_REASON', length: 1000, nullable: true })
  changeReason: string | null;

  @Column({ type: 'varchar2', name: 'APPROVED_BY', length: 50, nullable: true })
  approvedBy: string | null;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

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
