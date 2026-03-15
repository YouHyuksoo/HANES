/**
 * @file entities/customs-lot.entity.ts
 * @description 보세 LOT 엔티티 - 수입신고별 LOT 정보를 관리한다.
 *              복합 PK: entryNo + matUid
 *
 * 초보자 가이드:
 * 1. 복합 PK: entryNo(수입신고번호) + matUid(자재시리얼)
 * 2. status: BONDED(보세), CONSUMED(소진) 등
 * 3. remainQty = qty - usedQty
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PartMaster } from './part-master.entity';
import { CustomsEntry } from './customs-entry.entity';

@Entity({ name: 'CUSTOMS_LOTS' })
@Index(['status'])
export class CustomsLot {
  @PrimaryColumn({ name: 'ENTRY_NO', length: 50 })
  entryNo: string;

  @ManyToOne(() => CustomsEntry)
  @JoinColumn({ name: 'ENTRY_NO', referencedColumnName: 'entryNo' })
  entry: CustomsEntry;

  @PrimaryColumn({ name: 'MAT_UID', length: 100 })
  matUid: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @ManyToOne(() => PartMaster)
  @JoinColumn({ name: 'ITEM_CODE', referencedColumnName: 'itemCode' })
  item: PartMaster;

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
