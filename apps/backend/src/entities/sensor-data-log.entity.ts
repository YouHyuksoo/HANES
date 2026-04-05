/**
 * @file entities/sensor-data-log.entity.ts
 * @description 센서 데이터 로그 — 외부 시스템이 push한 설비 측정 데이터 저장
 *
 * 초보자 가이드:
 * 1. LOG_ID가 PK (Oracle IDENTITY — 로그성 데이터이므로 예외적 사용)
 * 2. equipCode + sensorType으로 설비별 센서 데이터 구분
 * 3. sensorType 예시: TEMPERATURE, VIBRATION, CURRENT, RUNTIME_HOURS, PRESSURE
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'SENSOR_DATA_LOGS' })
@Index(['equipCode', 'sensorType'])
@Index(['measuredAt'])
export class SensorDataLog {
  @PrimaryGeneratedColumn({ name: 'LOG_ID' })
  logId: number;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'SENSOR_TYPE', length: 30 })
  sensorType: string;

  @Column({ name: 'VALUE', type: 'number' })
  value: number;

  @Column({ type: 'varchar2', name: 'UNIT', length: 20, nullable: true })
  unit: string | null;

  @Column({ name: 'MEASURED_AT', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  measuredAt: Date;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
