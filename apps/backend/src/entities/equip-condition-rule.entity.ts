/**
 * @file entities/equip-condition-rule.entity.ts
 * @description 설비 조건 감시 규칙 — 센서값 임계치 초과 시 자동 조치 정의
 *
 * 초보자 가이드:
 * 1. RULE_ID가 PK (Oracle IDENTITY — 규칙 테이블이므로 예외적 사용)
 * 2. compareOp: GT(초과), GTE(이상), LT(미만), LTE(이하)
 * 3. actionType: ALERT(알림만), AUTO_WO(WO 자동생성), INTERLOCK(설비 정지)
 * 4. pmPlanCode: AUTO_WO 시 어떤 PM 계획 기반으로 WO를 생성할지
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'EQUIP_CONDITION_RULES' })
@Index(['equipCode', 'sensorType'])
export class EquipConditionRule {
  @PrimaryGeneratedColumn({ name: 'RULE_ID' })
  ruleId: number;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'SENSOR_TYPE', length: 30 })
  sensorType: string;

  @Column({ name: 'WARNING_VALUE', type: 'number', nullable: true })
  warningValue: number | null;

  @Column({ name: 'CRITICAL_VALUE', type: 'number', nullable: true })
  criticalValue: number | null;

  @Column({ name: 'COMPARE_OP', length: 5, default: 'GT' })
  compareOp: string;

  @Column({ name: 'ACTION_TYPE', length: 20, default: 'ALERT' })
  actionType: string;

  @Column({ type: 'varchar2', name: 'PM_PLAN_CODE', length: 50, nullable: true })
  pmPlanCode: string | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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
