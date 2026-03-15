/**
 * @file gauge-master.entity.ts
 * @description 계측기 마스터 엔티티 — IATF 16949 7.1.5 측정시스템분석(MSA)
 *
 * 초보자 가이드:
 * 1. 공장 내 사용되는 모든 계측기(게이지, 마이크로미터 등) 정보 관리
 * 2. 교정 주기(calibrationCycle)에 따라 다음 교정일 자동 계산
 * 3. 상태: ACTIVE(사용중) → EXPIRED(교정만료) → SCRAPPED(폐기)
 * 4. gaugeCode는 회사+공장 내에서 유일해야 함
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'GAUGE_MASTERS' })
export class GaugeMaster {
  @PrimaryColumn({ name: 'GAUGE_CODE', length: 50 })
  gaugeCode: string;

  @Column({ name: 'GAUGE_NAME', length: 200 })
  gaugeName: string;

  @Column({ name: 'GAUGE_TYPE', length: 50 })
  gaugeType: string;

  @Column({ name: 'MANUFACTURER', length: 200, nullable: true })
  manufacturer: string;

  @Column({ name: 'MODEL', length: 100, nullable: true })
  model: string;

  @Column({ name: 'SERIAL_NO', length: 100, nullable: true })
  serialNo: string;

  @Column({
    name: 'RESOLUTION',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  resolution: number;

  @Column({ name: 'MEASURE_RANGE', length: 100, nullable: true })
  measureRange: string;

  @Column({ name: 'CALIBRATION_CYCLE', type: 'int' })
  calibrationCycle: number;

  @Column({ name: 'LAST_CALIBRATION_DATE', type: 'timestamp', nullable: true })
  lastCalibrationDate: Date;

  @Column({ name: 'NEXT_CALIBRATION_DATE', type: 'timestamp', nullable: true })
  nextCalibrationDate: Date;

  @Column({ name: 'STATUS', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'LOCATION', length: 200, nullable: true })
  location: string;

  @Column({ name: 'RESPONSIBLE_PERSON', length: 50, nullable: true })
  responsiblePerson: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
