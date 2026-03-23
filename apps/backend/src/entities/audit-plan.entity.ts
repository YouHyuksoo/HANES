/**
 * @file audit-plan.entity.ts
 * @description 내부심사 계획 엔티티 — IATF 16949 9.2 내부심사
 *
 * 초보자 가이드:
 * 1. 내부심사(시스템/공정/제품/계층) 계획 등록 및 관리
 * 2. 상태 흐름: PLANNED → IN_PROGRESS → COMPLETED → CLOSED
 * 3. auditNo 자동채번: AUD-YYYYMMDD-NNN — PK (자연키)
 * 4. AuditFinding 엔티티와 1:N 관계 (부적합/관찰사항)
 * 5. overallResult: CONFORMING / MINOR_NC / MAJOR_NC / CRITICAL
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'AUDIT_PLANS' })
export class AuditPlan {
  @PrimaryColumn({ name: 'AUDIT_NO', length: 30 })
  auditNo: string;

  @Column({ name: 'AUDIT_TYPE', length: 30 })
  auditType: string;

  @Column({ name: 'AUDIT_SCOPE', length: 500 })
  auditScope: string;

  @Column({ name: 'TARGET_DEPT', length: 100, nullable: true })
  targetDept: string;

  @Column({ name: 'AUDITOR', length: 100 })
  auditor: string;

  @Column({ name: 'CO_AUDITOR', length: 100, nullable: true })
  coAuditor: string;

  @Column({ name: 'SCHEDULED_DATE', type: 'timestamp' })
  scheduledDate: Date;

  @Column({ name: 'ACTUAL_DATE', type: 'timestamp', nullable: true })
  actualDate: Date;

  @Column({ name: 'STATUS', length: 20, default: 'PLANNED' })
  status: string;

  @Column({ name: 'OVERALL_RESULT', length: 20, nullable: true })
  overallResult: string;

  @Column({ name: 'SUMMARY', length: 2000, nullable: true })
  summary: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
