/**
 * @file src/entities/proc-mat-stock.entity.ts
 * @description 공정재고(장착 대기) 엔티티 - 공정(PROCESS_CODE) 단위, 작업지시 무관 공용 재고
 *
 * 초보자 가이드:
 * - 자재 흐름(ADR 0002): 원자재창고(MAT_STOCKS) → [출고] → 공정재고(이 테이블=장착 대기)
 *   → [설비 장착] → 설비재고(WIP_MAT_STOCKS=장착됨) → [실적] → 차감.
 * - 복합 PK: (company, plant, processCode, itemCode, matUid). 설비가 아니라 공정 단위(위치=공정).
 * - qty: 총수량, reservedQty: 예약수량, availableQty: 가용수량.
 * - 가산/차감은 ProcMatStockService로만 수행하고, 이력은 PROC_MAT_TRANSACTIONS에 기록.
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'PROC_MAT_STOCKS' })
@Index(['processCode'])
@Index(['itemCode'])
export class ProcMatStock {
  @PrimaryColumn({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

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
