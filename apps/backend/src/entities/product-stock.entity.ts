/**
 * @file src/entities/product-stock.entity.ts
 * @description 제품 재고 엔티티 - 창고별 반제품/완제품 현재고
 *
 * 초보자 가이드:
 * - 복합 PK: (warehouseCode, itemCode, prdUid) 조합으로 재고 식별
 * - 원자재(RAW)는 MAT_STOCKS, 제품(WIP/FG)은 PRODUCT_STOCKS 테이블 사용
 * - qty: 총수량, reservedQty: 예약수량, availableQty: 가용수량
 * - itemType: 'WIP'(반제품) 또는 'FG'(완제품)
 * - orderNo: 작업지시 참조, processCode: 공정코드
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PRODUCT_STOCKS' })
@Index(['warehouseCode'])
@Index(['itemCode'])
@Index(['itemType'])
export class ProductStock {
  @PrimaryColumn({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @PrimaryColumn({ name: 'PRD_UID', length: 50 })
  prdUid: string;

  @Column({ name: 'LOCATION_CODE', length: 50, nullable: true })
  locationCode: string | null;

  @Column({ name: 'ITEM_TYPE', length: 10 })
  itemType: string;

  @Column({ name: 'ORDER_NO', length: 50, nullable: true })
  orderNo: string | null;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string | null;

  @Column({ name: 'QTY', type: 'int', default: 0 })
  qty: number;

  @Column({ name: 'RESERVED_QTY', type: 'int', default: 0 })
  reservedQty: number;

  @Column({ name: 'AVAILABLE_QTY', type: 'int', default: 0 })
  availableQty: number;

  @Column({ name: 'STATUS', length: 20, default: 'NORMAL' })
  status: string;

  @Column({ name: 'HOLD_REASON', length: 500, nullable: true })
  holdReason: string | null;

  @Column({ name: 'HOLD_AT', type: 'timestamp', nullable: true })
  holdAt: Date | null;

  @Column({ name: 'HOLD_BY', length: 50, nullable: true })
  holdBy: string | null;

  @Column({ name: 'LAST_COUNT', type: 'timestamp', nullable: true })
  lastCountAt: Date | null;

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
