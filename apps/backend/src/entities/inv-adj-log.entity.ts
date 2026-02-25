/**
 * @file src/entities/inv-adj-log.entity.ts
 * @description 재고 조정 로그 엔티티 - 재고 조정(실사/수동) 이력 기록
 *
 * 초보자 가이드:
 * - adjType: 조정 유형 (PHYSICAL_INV, MANUAL_ADJ 등)
 * - beforeQty/afterQty/diffQty: 조정 전/후/차이 수량
 * - id: SEQUENCE 자동증분 PK
 * - itemCode로 품목마스터(ITEM_MASTERS)와 연결
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'INV_ADJ_LOGS' })
@Index(['warehouseCode'])
@Index(['itemCode'])
@Index(['adjType'])
export class InvAdjLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'WAREHOUSE_CODE', length: 50 })
  warehouseCode: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'LOT_NO', length: 50, nullable: true })
  lotNo: string | null;

  @Column({ name: 'ADJ_TYPE', length: 50 })
  adjType: string;

  @Column({ name: 'BEFORE_QTY', type: 'int' })
  beforeQty: number;

  @Column({ name: 'AFTER_QTY', type: 'int' })
  afterQty: number;

  @Column({ name: 'DIFF_QTY', type: 'int' })
  diffQty: number;

  @Column({ name: 'REASON', length: 500, nullable: true })
  reason: string | null;

  @Column({ name: 'APPROVED_BY', length: 50, nullable: true })
  approvedBy: string | null;

  @Column({ name: 'APPROVED_AT', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
