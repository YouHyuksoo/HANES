/**
 * @file entities/customs-lot.entity.ts
 * @description 보세 LOT 엔티티 - 수입신고별 LOT 정보를 관리한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. entryId: 수입신고 ID 참조 (number)
 * 3. status: BONDED(보세), CONSUMED(소진) 등
 * 4. remainQty = qty - usedQty
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'CUSTOMS_LOTS' })
@Index(['entryId'])
@Index(['matUid'])
@Index(['status'])
export class CustomsLot {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'ENTRY_ID', type: 'number' })
  entryId: number;

  @Column({ name: 'MAT_UID', length: 100 })
  matUid: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'QTY', type: 'int' })
  qty: number;

  @Column({ name: 'USED_QTY', type: 'int', default: 0 })
  usedQty: number;

  @Column({ name: 'REMAIN_QTY', type: 'int', default: 0 })
  remainQty: number;

  @Column({ name: 'UNIT_PRICE', type: 'decimal', precision: 12, scale: 4, nullable: true })
  unitPrice: number | null;

  @Column({ name: 'STATUS', length: 50, default: 'BONDED' })
  status: string;

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
