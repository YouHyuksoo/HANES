/**
 * @file customer-order-item.entity.ts
 * @description 고객주문 품목(CustomerOrderItem) 엔티티 - 수주별 품목 내역을 관리한다.
 *              복합 PK: orderNo + seq
 *
 * 초보자 가이드:
 * 1. orderNo + seq가 복합 PK
 * 2. ORDER_ID로 CustomerOrder(수주)를 참조
 * 3. ITEM_CODE로 ItemMaster(품목)를 참조
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CUSTOMER_ORDER_ITEMS' })
@Index(['itemCode'])
export class CustomerOrderItem {
  @PrimaryColumn({ name: 'ORDER_ID', length: 50 })
  orderNo: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ORDER_QTY', type: 'int' })
  orderQty: number;

  @Column({ name: 'SHIPPED_QTY', type: 'int', default: 0 })
  shippedQty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitPrice: number | null;

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
