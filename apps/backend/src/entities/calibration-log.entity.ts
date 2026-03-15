/**
 * @file calibration-log.entity.ts
 * @description 교정 이력 엔티티 — IATF 16949 7.1.5 측정시스템분석(MSA)
 *              자연키 PK: calibrationNo (교정번호).
 *
 * 초보자 가이드:
 * 1. calibrationNo가 PK (자연키)
 * 2. calibrationNo 자동채번: CAL-YYYYMMDD-NNN
 * 3. 교정 유형: INTERNAL(사내교정), EXTERNAL(외부교정)
 * 4. 결과: PASS(합격), FAIL(불합격), CONDITIONAL(조건부 합격)
 * 5. gaugeCode로 GaugeMaster와 N:1 관계
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
import { GaugeMaster } from './gauge-master.entity';

@Entity({ name: 'CALIBRATION_LOGS' })
@Index(['gaugeCode'])
@Index(['company', 'plant', 'calibrationDate'])
export class CalibrationLog {
  @PrimaryColumn({ name: 'CALIBRATION_NO', length: 30 })
  calibrationNo: string;

  @Column({ name: 'GAUGE_CODE', length: 50 })
  gaugeCode: string;

  @ManyToOne(() => GaugeMaster)
  @JoinColumn({ name: 'GAUGE_CODE', referencedColumnName: 'gaugeCode' })
  gauge: GaugeMaster;

  @Column({ name: 'CALIBRATION_DATE', type: 'timestamp' })
  calibrationDate: Date;

  @Column({ name: 'CALIBRATION_TYPE', length: 30 })
  calibrationType: string;

  @Column({ name: 'CALIBRATOR', length: 100, nullable: true })
  calibrator: string;

  @Column({ name: 'CALIBRATION_ORG', length: 200, nullable: true })
  calibrationOrg: string;

  @Column({ name: 'STANDARD_USED', length: 200, nullable: true })
  standardUsed: string;

  @Column({ name: 'RESULT', length: 20 })
  result: string;

  @Column({
    name: 'MEASURED_VALUE',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  measuredValue: number;

  @Column({
    name: 'REFERENCE_VALUE',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  referenceValue: number;

  @Column({
    name: 'DEVIATION',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  deviation: number;

  @Column({
    name: 'UNCERTAINTY',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  uncertainty: number;

  @Column({ name: 'NEXT_DUE_DATE', type: 'timestamp', nullable: true })
  nextDueDate: Date;

  @Column({ name: 'CERTIFICATE_NO', length: 100, nullable: true })
  certificateNo: string;

  @Column({ name: 'REMARKS', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
