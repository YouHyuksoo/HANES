/**
 * @file src/entities/wip-mat-stock.entity.ts
 * @description 공정재고 엔티티 - 설비(EQUIP_CODE) 단위 전용 재공품 재고
 *
 * 초보자 가이드:
 * - 원자재재고(MAT_STOCKS)·완제품재고(PRODUCT_STOCKS)와 완전 분리된 공정 전용 재고
 * - 복합 PK: (company, plant, equipCode, itemCode, matUid) 조합으로 공정재고 식별
 * - qty: 총수량, reservedQty: 예약수량, availableQty: 가용수량
 * - 가산/차감은 WipMatStockService를 통해서만 수행하고, 이력은 WIP_MAT_TRANSACTIONS에 기록
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'WIP_MAT_STOCKS' })
@Index(['equipCode'])
@Index(['itemCode'])
export class WipMatStock {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @PrimaryColumn({ name: 'MAT_UID', length: 100 })
  matUid: string;

  @Column({ name: 'QTY', type: 'int', default: 0 })
  qty: number;

  @Column({ name: 'AVAILABLE_QTY', type: 'int', default: 0 })
  availableQty: number;

  @Column({ name: 'RESERVED_QTY', type: 'int', default: 0 })
  reservedQty: number;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
