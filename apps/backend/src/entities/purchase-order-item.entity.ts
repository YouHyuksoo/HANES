/**
 * @file purchase-order-item.entity.ts
 * @description 구매발주 품목(PurchaseOrderItem) 엔티티 - 발주별 품목 내역을 관리한다.
 *              시퀀스 PK 사용, poId → poNo, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. PO_NO로 PurchaseOrder(발주)를 참조
 * 3. ITEM_CODE로 ItemMaster(품목)를 참조
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PURCHASE_ORDER_ITEMS' })
@Index(['poNo'])
@Index(['itemCode'])
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'PO_NO', length: 50 })
  poNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ORDER_QTY', type: 'int' })
  orderQty: number;

  @Column({ name: 'RECEIVED_QTY', type: 'int', default: 0 })
  receivedQty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
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
