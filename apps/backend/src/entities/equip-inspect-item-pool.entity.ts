import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 설비-점검항목 연결 풀 — 특정 설비에 등록된 점검항목 링크
 *  PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE
 */
@Entity({ name: 'EQUIP_INSPECT_ITEM_POOL' })
export class EquipInspectItemPool {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'EQUIP_CODE', length: 36 })
  equipCode: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 30 })
  itemCode: string;

  @PrimaryColumn({ name: 'INSPECT_TYPE', length: 20 })
  inspectType: string;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'SORT_SEQ', type: 'number', nullable: true })
  sortSeq: number | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
