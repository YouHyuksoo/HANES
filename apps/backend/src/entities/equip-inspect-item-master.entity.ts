/**
 * @file entities/equip-inspect-item-master.entity.ts
 * @description 설비 점검항목 마스터 엔티티 - 설비별 점검항목을 관리한다.
 *              복합키: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + SEQ
 *
 * 초보자 가이드:
 * 1. 복합 PK: company + plant + equipCode + inspectType + seq
 * 2. equipCode: 대상 설비 코드
 * 3. inspectType: 점검 유형 (DAILY, PERIODIC, PM)
 * 4. seq: 항목 순서
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'EQUIP_INSPECT_ITEM_MASTERS' })
export class EquipInspectItemMaster {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'EQUIP_CODE', length: 36 })
  equipCode: string;

  @PrimaryColumn({ name: 'INSPECT_TYPE', length: 20 })
  inspectType: string;

  @PrimaryColumn({ name: 'SEQ', type: 'number' })
  seq: number;

  @Column({ name: 'ITEM_NAME', length: 200 })
  itemName: string;

  @Column({ name: 'CRITERIA', length: 500, nullable: true })
  criteria: string | null;

  @Column({ name: 'CYCLE', length: 20, nullable: true })
  cycle: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;

  @Column({ name: 'DELETED_AT', nullable: true })
  deletedAt: Date | null;
}
