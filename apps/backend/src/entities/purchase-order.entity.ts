/**
 * @file purchase-order.entity.ts
 * @description 구매발주(PurchaseOrder) 엔티티 - 구매발주 정보를 관리한다.
 *              poNo를 자연키 PK로 사용.
 *
 * 초보자 가이드:
 * 1. PO_NO가 PK (UUID 대신 자연키)
 * 2. 상태 흐름: DRAFT → CONFIRMED → CLOSED
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PURCHASE_ORDERS' })
@Index(['status'])
@Index(['orderDate'])
export class PurchaseOrder {
  @PrimaryColumn({ name: 'PO_NO', length: 50 })
  poNo: string;

  @Column({ name: 'PARTNER_ID', length: 255, nullable: true })
  partnerId: string | null;

  @Column({ name: 'PARTNER_NAME', length: 255, nullable: true })
  partnerName: string | null;

  @Column({ name: 'ORDER_DATE', type: 'date', nullable: true })
  orderDate: Date | null;

  @Column({ name: 'DUE_DATE', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'STATUS', length: 50, default: 'DRAFT' })
  status: string;

  @Column({ name: 'TOTAL_AMOUNT', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalAmount: number | null;

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
