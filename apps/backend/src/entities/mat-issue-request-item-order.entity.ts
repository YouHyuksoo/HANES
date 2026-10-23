/**
 * @file entities/mat-issue-request-item-order.entity.ts
 * @description 묶음 출고요청 작업지시별 수량 엔티티 (MAT_ISSUE_REQUEST_ITEM_ORDERS 테이블)
 *
 * 초보자 가이드:
 * - 같은 공정 작업지시 여러 건을 출고요청 1건으로 묶을 때 쓴다. 이 테이블에 행이 있는 요청이 묶음 요청이다.
 * - 품목(MatIssueRequestItem) 1줄(합계) 아래 작업지시별 요청/출고수량을 둔다.
 * - 품목별 SUM(requestQty)=품목 requestQty, SUM(issuedQty)=품목 issuedQty (기준정보검증 TXN_INVARIANT 가 검사)
 * - 출고 수량은 작업지시 계획일 빠른 순으로 배분한다(issue-request-order-split.ts).
 */

import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'MAT_ISSUE_REQUEST_ITEM_ORDERS' })
@Index(['company', 'plant', 'orderNo'])
export class MatIssueRequestItemOrder {
  @PrimaryColumn({ type: 'varchar2', name: 'REQUEST_ID', length: 50 })
  requestId: string;

  @PrimaryColumn({ type: 'int', name: 'ITEM_SEQ' })
  itemSeq: number;

  @PrimaryColumn({ type: 'varchar2', name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ type: 'int', name: 'REQUEST_QTY' })
  requestQty: number;

  @Column({ type: 'int', name: 'ISSUED_QTY', default: 0 })
  issuedQty: number;

  @Column({ name: 'BOM_REQ_QTY', type: 'number', precision: 12, scale: 3, nullable: true })
  bomReqQty: number | null;

  @Column({ name: 'PREV_ISSUE_QTY', type: 'number', precision: 12, scale: 3, nullable: true })
  prevIssueQty: number | null;

  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
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
