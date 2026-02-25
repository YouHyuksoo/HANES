/**
 * @file subcon-order.entity.ts
 * @description 외주발주(SubconOrder) 엔티티 - 외주 가공 발주 정보를 관리한다.
 *              orderNo를 자연키 PK로 사용.
 *
 * 초보자 가이드:
 * 1. ORDER_NO가 PK (UUID 대신 자연키)
 * 2. 상태 흐름: ORDERED → DELIVERED → RECEIVED → CLOSED
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SUBCON_ORDERS' })
@Index(['vendorId'])
@Index(['status'])
@Index(['orderDate'])
export class SubconOrder {
  @PrimaryColumn({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ name: 'VENDOR_ID', length: 255 })
  vendorId: string;

  @Column({ name: 'PART_CODE', length: 255 })
  partCode: string;

  @Column({ name: 'PART_NAME', length: 255, nullable: true })
  partName: string | null;

  @Column({ name: 'ORDER_QTY', type: 'int' })
  orderQty: number;

  @Column({ name: 'DELIVERED_QTY', type: 'int', default: 0 })
  deliveredQty: number;

  @Column({ name: 'RECEIVED_QTY', type: 'int', default: 0 })
  receivedQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'ORDER_DATE', type: 'date', nullable: true })
  orderDate: Date | null;

  @Column({ name: 'DUE_DATE', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'STATUS', length: 50, default: 'ORDERED' })
  status: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 255, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 255, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 255, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 255, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
