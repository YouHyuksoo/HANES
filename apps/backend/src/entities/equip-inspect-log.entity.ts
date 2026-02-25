/**
 * @file entities/equip-inspect-log.entity.ts
 * @description 설비 점검 이력 엔티티 - 설비 점검 결과를 저장한다.
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. equipCode: 대상 설비 코드
 * 3. details: CLOB JSON으로 항목별 점검 결과 저장
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'EQUIP_INSPECT_LOGS' })
@Index(['equipCode'])
@Index(['inspectType'])
@Index(['inspectDate'])
export class EquipInspectLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'INSPECT_TYPE', length: 50 })
  inspectType: string;

  @Column({ name: 'INSPECT_DATE', type: 'date' })
  inspectDate: Date;

  @Column({ name: 'INSPECTOR_NAME', length: 100, nullable: true })
  inspectorName: string | null;

  @Column({ name: 'OVERALL_RESULT', length: 50, default: 'PASS' })
  overallResult: string;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

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
