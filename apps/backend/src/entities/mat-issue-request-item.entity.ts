/**
 * @file entities/mat-issue-request-item.entity.ts
 * @description 자재 출고요청 품목 엔티티 (MAT_ISSUE_REQUEST_ITEMS 테이블)
 *
 * 초보자 가이드:
 * - MatIssueRequest의 상세 품목 테이블
 * - requestId + seq 복합 PK
 * - itemCode로 품목 마스터(ITEM_MASTERS)와 연결
 * - requestQty: 요청 수량, issuedQty: 실제 출고된 수량
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_ISSUE_REQUEST_ITEMS' })
@Index(['itemCode'])
export class MatIssueRequestItem {
  @PrimaryColumn({ name: 'REQUEST_ID', length: 50 })
  requestId: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'REQUEST_QTY', type: 'int' })
  requestQty: number;

  @Column({ name: 'ISSUED_QTY', type: 'int', default: 0 })
  issuedQty: number;

  @Column({ name: 'UNIT', length: 20 })
  unit: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
