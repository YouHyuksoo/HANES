import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'QUALITY_PLAN_EVENTS' })
@Index(['company', 'plant', 'packageId'])
export class QualityPlanEventEntity {
  @PrimaryColumn({ name: 'EVENT_ID', type: 'number' }) eventId: number;
  @Column({ name: 'PACKAGE_ID', type: 'number' }) packageId: number;
  @Column({ name: 'DOCUMENT_ID', type: 'number', nullable: true }) documentId: number | null;
  @Column({ name: 'REVISION_ID', type: 'number', nullable: true }) revisionId: number | null;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'EVENT_TYPE', type: 'varchar2', length: 30 }) eventType: string;
  @Column({ name: 'ACTOR_ID', type: 'varchar2', length: 50 }) actorId: string;
  @Column({ name: 'DETAIL', type: 'clob', nullable: true }) detail: string | null;
  @CreateDateColumn({ name: 'OCCURRED_AT', type: 'timestamp' }) occurredAt: Date;
}
