/**
 * @file subcon-delivery.entity.ts
 * @description 외주납품(SubconDelivery) 엔티티 - 외주 가공 납품 정보를 기록한다.
 *              자연키 PK: deliveryNo (납품번호).
 *
 * 초보자 가이드:
 * 1. deliveryNo가 PK (자연키)
 * 2. ORDER_ID로 SubconOrder(외주발주)를 참조
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SUBCON_DELIVERIES' })
@Index(['orderNo'])
@Index(['deliveredAt'])
export class SubconDelivery {
  @Column({ name: 'ORDER_ID', length: 50 })
  orderNo: string;

  @PrimaryColumn({ name: 'DELIVERY_NO', length: 255 })
  deliveryNo: string;

  @Column({ type: 'varchar2', name: 'MAT_UID', length: 50, nullable: true })
  matUid: string | null;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'DELIVERY_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  deliveredAt: Date;

  @Column({ type: 'varchar2', name: 'WORKER_ID', length: 255, nullable: true })
  workerId: string | null;

  @Column({ name: 'STATUS', length: 50, default: 'DONE' })
  status: string;

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
}
