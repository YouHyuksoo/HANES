/**
 * @file shipment-return-item.entity.ts
 * @description 출하반품 품목(ShipmentReturnItem) 엔티티 - 반품별 품목 내역을 관리한다.
 *              시퀀스 PK 사용, returnId → returnId 유지, partId → itemCode로 변환됨.
 *
 * 초보자 가이드:
 * 1. ID는 자동 증가 시퀀스 (number)
 * 2. RETURN_ID로 ShipmentReturn(반품)을 참조
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

@Entity({ name: 'SHIPMENT_RETURN_ITEMS' })
@Index(['returnId'])
@Index(['itemCode'])
export class ShipmentReturnItem {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'RETURN_ID', type: 'int' })
  returnId: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'RETURN_QTY', type: 'int' })
  returnQty: number;

  @Column({ name: 'DISPOSAL_TYPE', length: 50, default: 'RESTOCK' })
  disposalType: string;

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
