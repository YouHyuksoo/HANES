/**
 * @file change-order.entity.ts
 * @description 4M 변경점관리 엔티티 — IATF 16949 8.5.6 생산 변경 관리
 *
 * 초보자 가이드:
 * 1. 생산 4M(Man, Machine, Material, Method) 변경 시 사전 평가 및 승인 관리
 * 2. 상태 흐름: DRAFT → SUBMITTED → REVIEWING → APPROVED → IN_PROGRESS → COMPLETED → CLOSED
 *              REVIEWING → REJECTED (반려 시)
 * 3. changeNo 자동채번: ECN-YYYYMMDD-NNN
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CHANGE_ORDERS' })
@Index(['company', 'plant', 'status'])
export class ChangeOrder {
  @PrimaryColumn({ name: 'CHANGE_NO', length: 50 })
  changeNo: string;

  @Column({ name: 'CHANGE_TYPE', length: 30 })
  changeType: string;

  @Column({ name: 'TITLE', length: 200 })
  title: string;

  @Column({ name: 'DESCRIPTION', length: 2000, nullable: true })
  description: string;

  @Column({ name: 'REASON', length: 1000, nullable: true })
  reason: string;

  @Column({ name: 'RISK_ASSESSMENT', length: 1000, nullable: true })
  riskAssessment: string;

  @Column({ name: 'AFFECTED_ITEMS', length: 2000, nullable: true })
  affectedItems: string;

  @Column({ name: 'AFFECTED_PROCESSES', length: 2000, nullable: true })
  affectedProcesses: string;

  @Column({ name: 'PRIORITY', length: 20, default: 'MEDIUM' })
  priority: string;

  @Column({ name: 'STATUS', length: 30, default: 'DRAFT' })
  status: string;

  @Column({ name: 'REQUESTED_BY', length: 50, nullable: true })
  requestedBy: string;

  @Column({ name: 'REQUESTED_AT', type: 'timestamp', nullable: true })
  requestedAt: Date;

  @Column({ name: 'REVIEWER_CODE', length: 50, nullable: true })
  reviewerCode: string;

  @Column({ name: 'REVIEWED_AT', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'REVIEW_COMMENT', length: 1000, nullable: true })
  reviewComment: string;

  @Column({ name: 'APPROVER_CODE', length: 50, nullable: true })
  approverCode: string;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'APPROVE_COMMENT', length: 1000, nullable: true })
  approveComment: string;

  @Column({ name: 'EFFECTIVE_DATE', type: 'date', nullable: true })
  effectiveDate: Date;

  @Column({ name: 'COMPLETION_DATE', type: 'date', nullable: true })
  completionDate: Date;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
