import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'QUALITY_PLAN_PARTICIPANTS' })
export class QualityPlanParticipantEntity {
  @PrimaryColumn({ name: 'PARTICIPANT_ID', type: 'number' }) participantId: number;
  @Column({ name: 'REVISION_ID', type: 'number' }) revisionId: number;
  @Column({ name: 'COMPANY', type: 'varchar2', length: 50 }) company: string;
  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 }) plant: string;
  @Column({ name: 'ROLE', type: 'varchar2', length: 20 }) role: string;
  @Column({ name: 'USER_ID', type: 'varchar2', length: 50, nullable: true }) userId: string | null;
  @Column({ name: 'USER_NAME', type: 'varchar2', length: 100 }) userName: string;
  @Column({ name: 'ORGANIZATION', type: 'varchar2', length: 200, nullable: true }) organization: string | null;
  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' }) createdAt: Date;
}
