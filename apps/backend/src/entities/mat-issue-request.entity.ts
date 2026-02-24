/**
 * @file entities/mat-issue-request.entity.ts
 * @description 자재 출고요청 엔티티 (MAT_ISSUE_REQUESTS 테이블)
 *
 * 초보자 가이드:
 * - 자재 출고를 요청하는 헤더 테이블
 * - 상태 흐름: REQUESTED → APPROVED → COMPLETED (또는 REJECTED)
 * - 요청 품목은 MatIssueRequestItem 엔티티에서 관리

 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_ISSUE_REQUESTS' })
@Index(['jobOrderId'])
@Index(['status'])
@Index(['requestDate'])
export class MatIssueRequest {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'REQUEST_NO', length: 50, unique: true })
  requestNo: string;

  @Column({ name: 'JOB_ORDER_ID', length: 50, nullable: true })
  jobOrderId: string | null;

  @Column({ name: 'REQUEST_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  requestDate: Date;

  @Column({ name: 'STATUS', length: 20, default: 'REQUESTED' })
  status: string;

  @Column({ name: 'REQUESTER', length: 100 })
  requester: string;

  @Column({ name: 'APPROVER', length: 100, nullable: true })
  approver: string | null;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'REJECT_REASON', length: 500, nullable: true })
  rejectReason: string | null;

  @Column({ name: 'ISSUE_TYPE', length: 20, nullable: true })
  issueType: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
