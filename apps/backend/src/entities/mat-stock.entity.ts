/**
 * @file src/entities/mat-stock.entity.ts
 * @description 원자재 재고 엔티티 - 창고별 원자재 현재고 관리
 *
 * 초보자 가이드:
 * - 복합 PK: (warehouseCode, itemCode, lotNo) 조합으로 재고 식별
 * - qty: 총수량, reservedQty: 예약수량, availableQty: 가용수량
 * - 제품 재고는 PRODUCT_STOCKS 테이블 사용
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'MAT_STOCKS' })
@Index(['warehouseCode'])
@Index(['itemCode'])
export class MatStock {
  @PrimaryColumn({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @PrimaryColumn({ name: 'LOT_NO', length: 50 })
  lotNo: string;

  @Column({ name: 'LOCATION_CODE', length: 50, nullable: true })
  locationCode: string | null;

  @Column({ name: 'QTY', type: 'int', default: 0 })
  qty: number;

  @Column({ name: 'RESERVED_QTY', type: 'int', default: 0 })
  reservedQty: number;

  @Column({ name: 'AVAILABLE_QTY', type: 'int', default: 0 })
  availableQty: number;

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
