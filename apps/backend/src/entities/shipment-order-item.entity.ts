/**
 * @file shipment-order-item.entity.ts
 * @description 출하지시 품목(ShipmentOrderItem) 엔티티 - 출하지시별 품목 내역을 관리한다.
 *              시퀀스 PK 사용, shipOrderId → shipOrderNo, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. SHIP_ORDER_NO로 ShipmentOrder(출하지시)를 참조
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

@Entity({ name: 'SHIPMENT_ORDER_ITEMS' })
@Index(['shipOrderNo'])
@Index(['itemCode'])
export class ShipmentOrderItem {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'SHIP_ORDER_NO', length: 50 })
  shipOrderNo: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ORDER_QTY', type: 'int' })
  orderQty: number;

  @Column({ name: 'SHIPPED_QTY', type: 'int', default: 0 })
  shippedQty: number;

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
