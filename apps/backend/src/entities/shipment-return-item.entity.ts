/**
 * @file shipment-return-item.entity.ts
 * @description 출하반품 품목(ShipmentReturnItem) 엔티티 - 반품별 품목 내역을 관리한다.
 *              복합 PK: returnNo + seq
 *
 * 초보자 가이드:
 * 1. returnNo + seq가 복합 PK
 * 2. RETURN_NO로 ShipmentReturn(반품)을 참조 (FK -> SHIPMENT_RETURNS.RETURN_NO)
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

@Entity({ name: 'SHIPMENT_RETURN_ITEMS' })
@Index(['itemCode'])
export class ShipmentReturnItem {
  @PrimaryColumn({ name: 'RETURN_NO', length: 50 })
  returnNo: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

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
