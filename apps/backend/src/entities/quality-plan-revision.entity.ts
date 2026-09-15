import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'QUALITY_PLAN_REVISIONS' })
@Index(['company', 'plant', 'documentId', 'revisionCode'], { unique: true })
export class QualityPlanRevisionEntity {
  @PrimaryColumn({ name: 'REVISION_ID', type: 'number' }) revisionId: number;
  @Column({ name: 'DOCUMENT_ID', type: 'number' }) documentId: number;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'REVISION_CODE', type: 'varchar2', length: 10 }) revisionCode: string;
  @Column({ name: 'STATUS', type: 'varchar2', length: 20, default: 'DRAFT' }) status: string;
  @Column({ name: 'ISSUE_DATE', type: 'date', nullable: true }) issueDate: Date | null;
  @Column({ name: 'REVISION_DATE', type: 'date', nullable: true }) revisionDate: Date | null;
  @Column({ name: 'PUBLISHED_AT', type: 'timestamp', nullable: true }) publishedAt: Date | null;
  @Column({ name: 'CHANGE_REASON', type: 'varchar2', length: 1000, nullable: true }) changeReason: string | null;
  @Column({ name: 'CHANGE_DESCRIPTION', type: 'clob', nullable: true }) changeDescription: string | null;
  @Column({ name: 'AUTHOR_ID', type: 'varchar2', length: 50 }) authorId: string;
  @Column({ name: 'PUBLISHER_ID', type: 'varchar2', length: 50, nullable: true }) publisherId: string | null;
  @Column({ name: 'REF_PFD_REVISION_ID', type: 'number', nullable: true }) referencedPfdRevisionId: number | null;
  @Column({ name: 'REF_PFMEA_REVISION_ID', type: 'number', nullable: true }) referencedPfmeaRevisionId: number | null;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' }) updatedAt: Date;
}
