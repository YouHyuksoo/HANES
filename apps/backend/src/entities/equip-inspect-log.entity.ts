/**
 * @file entities/equip-inspect-log.entity.ts
 * @description 설비 점검 이력 엔티티 - 설비 점검 결과를 저장한다.
 *              복합키: EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE
 *
 * 초보자 가이드:
 * 1. 복합 PK: equipCode + inspectType + inspectDate
 * 2. details: CLOB JSON으로 항목별 점검 결과 저장
 * 3. 하루에 설비당 동일 점검유형은 1건만 가능
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'EQUIP_INSPECT_LOGS' })
export class EquipInspectLog {
  @PrimaryColumn({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @PrimaryColumn({ name: 'INSPECT_TYPE', length: 50 })
  inspectType: string;

  @PrimaryColumn({ name: 'INSPECT_DATE', type: 'date' })
  inspectDate: Date;

  @Column({ type: 'varchar2', name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'OVERALL_RESULT', length: 50, default: 'PASS' })
  overallResult: string;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
