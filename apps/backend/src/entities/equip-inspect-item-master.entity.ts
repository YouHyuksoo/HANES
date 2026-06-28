import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 설비점검항목 기준 마스터 — 설비유형별 점검항목 템플릿
 *  PK: COMPANY + PLANT_CD + ITEM_CODE
 */
@Entity({ name: 'EQUIP_INSPECT_ITEM_MASTERS' })
export class EquipInspectItemMaster {
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

  @Column({ type: 'varchar2', name: 'EQUIP_TYPE', length: 50, nullable: true })
  equipType: string | null;

  @Column({ name: 'ITEM_TYPE', length: 20, default: 'VISUAL' })
  itemType: string;

  @Column({ type: 'varchar2', name: 'CRITERIA', length: 500, nullable: true })
  criteria: string | null;

  @Column({ type: 'varchar2', name: 'CYCLE', length: 20 })
  cycle: string;

  @Column({ type: 'varchar2', name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'LSL_VALUE', type: 'number', nullable: true })
  lslValue: number | null;

  @Column({ name: 'USL_VALUE', type: 'number', nullable: true })
  uslValue: number | null;

  @Column({ type: 'varchar2', name: 'WORKER_QR_CODE', length: 50, nullable: true })
  workerQrCode: string | null;

  @Column({ type: 'varchar2', name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
