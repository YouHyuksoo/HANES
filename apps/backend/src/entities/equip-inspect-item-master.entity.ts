/**
 * @file entities/equip-inspect-item-master.entity.ts
 * @description 설비 점검항목 마스터 엔티티 - 설비별 점검항목을 관리한다.
 *              복합키: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + SEQ
 *
 * 초보자 가이드:
 * 1. 복합 PK: company + plant + equipCode + inspectType + seq
 * 2. equipCode: 대상 설비 코드
 * 3. inspectType: 점검 유형 (DAILY, PERIODIC, PM, WORKER) — WORKER는 작업자설비점검 항목
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

  @Column({ type: 'varchar2', name: 'ITEM_CODE', length: 30, nullable: true })
  itemCode: string | null;

  @Column({ name: 'ITEM_NAME', length: 200 })
  itemName: string;

  @Column({ type: 'varchar2', name: 'CRITERIA', length: 500, nullable: true })
  criteria: string | null;

  @Column({ type: 'varchar2', name: 'CYCLE', length: 20, nullable: true })
  cycle: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  /** MEASURE(측정형) | VISUAL(판정형) */
  @Column({ name: 'ITEM_TYPE', length: 20, default: 'VISUAL' })
  itemType: string;

  @Column({ type: 'varchar2', name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'LSL_VALUE', type: 'number', nullable: true })
  lslValue: number | null;

  @Column({ name: 'USL_VALUE', type: 'number', nullable: true })
  uslValue: number | null;

  /** 작업자점검 QR 코드 페이로드 (INSPECT_TYPE='WORKER' 항목에만 사용) */
  @Column({ type: 'varchar2', name: 'WORKER_QR_CODE', length: 50, nullable: true })
  workerQrCode: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

}
