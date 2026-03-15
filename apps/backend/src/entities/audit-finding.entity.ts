/**
 * @file audit-finding.entity.ts
 * @description 내부심사 발견사항 엔티티 — 부적합/관찰사항/개선기회
 *
 * 초보자 가이드:
 * 1. AuditPlan에 연결된 개별 발견사항 기록
 * 2. 복합 PK: auditId + findingNo (부모 FK + 발견사항 번호)
 * 3. category: NC_MAJOR(중부적합), NC_MINOR(경부적합), OBSERVATION(관찰사항), OFI(개선기회)
 * 4. clauseRef: IATF 16949 조항 참조 (예: "8.7.1")
 * 5. capaId: CAPA(시정/예방조치)와 연결 가능
 * 6. 상태: OPEN → IN_PROGRESS → CLOSED
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditPlan } from './audit-plan.entity';

@Entity({ name: 'AUDIT_FINDINGS' })
@Index(['capaId'])
export class AuditFinding {
  @PrimaryColumn({ name: 'AUDIT_ID' })
  auditId: number;

  @ManyToOne(() => AuditPlan)
  @JoinColumn({ name: 'AUDIT_ID' })
  audit: AuditPlan;

  @PrimaryColumn({ name: 'FINDING_NO', type: 'int' })
  findingNo: number;

  @Column({ name: 'CLAUSE_REF', length: 50, nullable: true })
  clauseRef: string;

  @Column({ name: 'CATEGORY', length: 30 })
  category: string;

  @Column({ name: 'DESCRIPTION', length: 2000 })
  description: string;

  @Column({ name: 'EVIDENCE', length: 1000, nullable: true })
  evidence: string;

  @Column({ name: 'CAPA_ID', type: 'int', nullable: true })
  capaId: number;

  @Column({ name: 'DUE_DATE', type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ name: 'CLOSED_AT', type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column({ name: 'STATUS', length: 20, default: 'OPEN' })
  status: string;

  @Column({ name: 'REMARKS', length: 500, nullable: true })
  remarks: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;
}
