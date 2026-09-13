/**
 * @file inspect-item-spec.entity.ts
 * @description 품목별 리크/내전압/토크 검사 스펙 마스터
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'INSPECT_ITEM_SPECS' })
@Index('UK_INSPECT_ITEM_SPECS', ['company', 'plant', 'itemCode', 'inspectType', 'connectorKey'], { unique: true })
export class InspectItemSpec {
  @PrimaryColumn({ name: 'SPEC_ID', type: 'number' })
  specId: number;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'INSPECT_TYPE', length: 20 })
  inspectType: string;

  @Column({ name: 'CONNECTOR_KEY', length: 50, default: '*' })
  connectorKey: string;

  @Column({ name: 'CHARGE_BAR', type: 'decimal', precision: 10, scale: 3, nullable: true })
  chargeBar: number | null;

  @Column({ name: 'CHARGE_TOL_BAR', type: 'decimal', precision: 10, scale: 3, nullable: true })
  chargeTolBar: number | null;

  @Column({ name: 'MEASURE_BAR', type: 'decimal', precision: 10, scale: 3, nullable: true })
  measureBar: number | null;

  @Column({ name: 'MEASURE_TOL_BAR', type: 'decimal', precision: 10, scale: 3, nullable: true })
  measureTolBar: number | null;

  @Column({ name: 'HOLD_SECONDS', type: 'decimal', precision: 10, scale: 3, nullable: true })
  holdSeconds: number | null;

  @Column({ name: 'MIN_HOLD_BAR', type: 'decimal', precision: 10, scale: 3, nullable: true })
  minHoldBar: number | null;

  @Column({ name: 'TEST_VOLTAGE_KV', type: 'decimal', precision: 10, scale: 3, nullable: true })
  testVoltageKv: number | null;

  @Column({ name: 'TEST_SECONDS', type: 'decimal', precision: 10, scale: 3, nullable: true })
  testSeconds: number | null;

  @Column({ name: 'MAX_CURRENT_MA', type: 'decimal', precision: 10, scale: 3, nullable: true })
  maxCurrentMa: number | null;

  @Column({ name: 'TORQUE_LSL', type: 'decimal', precision: 10, scale: 3, nullable: true })
  torqueLsl: number | null;

  @Column({ name: 'TORQUE_USL', type: 'decimal', precision: 10, scale: 3, nullable: true })
  torqueUsl: number | null;

  @Column({ type: 'varchar2', name: 'TORQUE_UNIT', length: 20, nullable: true })
  torqueUnit: string | null;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
