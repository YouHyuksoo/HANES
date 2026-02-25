/**
 * @file subcon-delivery.entity.ts
 * @description 외주납품(SubconDelivery) 엔티티 - 외주 가공 납품 정보를 기록한다.
 *              시퀀스 PK 사용, orderId → orderNo로 SubconOrder 참조.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. ORDER_NO로 SubconOrder(외주발주)를 참조
 * 3. DELIVERY_NO: 납품번호 (유니크)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'SUBCON_DELIVERIES' })
@Unique(['deliveryNo'])
@Index(['orderNo'])
@Index(['deliveredAt'])
export class SubconDelivery {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ORDER_NO', length: 50 })
  orderNo: string;

  @Column({ name: 'DELIVERY_NO', length: 255, unique: true })
  deliveryNo: string;

  @Column({ name: 'LOT_NO', length: 255, nullable: true })
  lotNo: string | null;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'DELIVERY_DATE', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  deliveredAt: Date;

  @Column({ name: 'WORKER_ID', length: 255, nullable: true })
  workerId: string | null;

  @Column({ name: 'STATUS', length: 50, default: 'DONE' })
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
}
