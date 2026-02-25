/**
 * @file shipment-order.entity.ts
 * @description 출하지시(ShipmentOrder) 엔티티 - 출하 지시 정보를 관리한다.
 *              shipOrderNo를 자연키 PK로 사용.
 *
 * 초보자 가이드:
 * 1. SHIP_ORDER_NO가 PK (UUID 대신 자연키)
 * 2. 상태 흐름: DRAFT → CONFIRMED → SHIPPED → CLOSED
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SHIPMENT_ORDERS' })
@Index(['status'])
@Index(['dueDate'])
export class ShipmentOrder {
  @PrimaryColumn({ name: 'SHIP_ORDER_NO', length: 50 })
  shipOrderNo: string;

  @Column({ name: 'CUSTOMER_ID', length: 255, nullable: true })
  customerId: string | null;

  @Column({ name: 'CUSTOMER_NAME', length: 100, nullable: true })
  customerName: string | null;

  @Column({ name: 'DUE_DATE', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'SHIP_DATE', type: 'date', nullable: true })
  shipDate: Date | null;

  @Column({ name: 'STATUS', length: 50, default: 'DRAFT' })
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
