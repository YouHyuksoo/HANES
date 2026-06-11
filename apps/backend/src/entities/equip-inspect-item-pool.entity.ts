import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'EQUIP_INSPECT_ITEM_POOL' })
export class EquipInspectItemPool {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'ITEM_CODE', length: 30 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 200 })
  itemName: string;

  @Column({ name: 'INSPECT_TYPE', length: 20 })
  inspectType: string;

  @Column({ type: 'varchar2', name: 'CRITERIA', length: 500, nullable: true })
  criteria: string | null;

  @Column({ type: 'varchar2', name: 'CYCLE', length: 20, nullable: true })
  cycle: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  /** 판정형(VISUAL) | 측정형(MEASURE) — IQC 방식과 동일 */
  @Column({ name: 'ITEM_TYPE', length: 20, default: 'VISUAL' })
  itemType: string;

  /** 측정형 단위 (mm, ℃, bar 등) */
  @Column({ type: 'varchar2', name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  /** 측정형 하한값 (Lower Specification Limit) */
  @Column({ name: 'LSL_VALUE', type: 'number', nullable: true })
  lslValue: number | null;

  /** 측정형 상한값 (Upper Specification Limit) */
  @Column({ name: 'USL_VALUE', type: 'number', nullable: true })
  uslValue: number | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
