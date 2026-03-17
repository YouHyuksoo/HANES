/**
 * @file entities/repair-used-part.entity.ts
 * @description 수리 사용부품 디테일 엔티티 - 수리에 사용된 품목/시리얼 기록
 *
 * 초보자 가이드:
 * 1. 복합 PK: repairDate + seq (부모 RepairOrder FK)
 * 2. 하나의 수리오더에 여러 사용부품 행 가능
 * 3. itemCode: PartMaster FK, prdUid: 제품 고유식별자(시리얼)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'REPAIR_USED_PARTS' })
export class RepairUsedPart {
  @PrimaryColumn({ name: 'REPAIR_DATE', type: 'date' })
  repairDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string | null;

  @Column({ name: 'PRD_UID', length: 50, nullable: true })
  prdUid: string | null;

  @Column({ name: 'QTY', type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
