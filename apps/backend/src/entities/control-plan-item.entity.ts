/**
 * @file control-plan-item.entity.ts
 * @description 관리계획서 항목(Control Plan Item) 엔티티 — IATF 16949 8.5.1.1
 *
 * 초보자 가이드:
 * 1. 관리계획서(ControlPlan)의 개별 관리 항목 (공정별 품질특성, 관리방법 등)
 * 2. 복합 PK: controlPlanId(planNo) + seq (부모 FK + 순번)
 * 3. specialCharClass: CC(Critical), SC(Significant), HI(High Impact) 등 특별특성 분류
 * 4. 각 항목에 규격, 평가방법, 시료수/주기, 관리방법, 이상 시 대응계획 기록
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ControlPlan } from './control-plan.entity';

@Entity({ name: 'CONTROL_PLAN_ITEMS' })
export class ControlPlanItem {
  @PrimaryColumn({ name: 'CONTROL_PLAN_ID', length: 30 })
  controlPlanId: string;

  @ManyToOne(() => ControlPlan, { nullable: false })
  @JoinColumn({ name: 'CONTROL_PLAN_ID' })
  controlPlan: ControlPlan;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'PROCESS_CODE', length: 50, nullable: true })
  processCode: string;

  @Column({ name: 'PROCESS_NAME', length: 200 })
  processName: string;

  @Column({ name: 'CHARACTERISTIC_NO', length: 30, nullable: true })
  characteristicNo: string;

  @Column({ name: 'PRODUCT_CHARACTERISTIC', length: 200, nullable: true })
  productCharacteristic: string;

  @Column({ name: 'PROCESS_CHARACTERISTIC', length: 200, nullable: true })
  processCharacteristic: string;

  @Column({ name: 'SPECIAL_CHAR_CLASS', length: 10, nullable: true })
  specialCharClass: string;

  @Column({ name: 'SPECIFICATION', length: 500, nullable: true })
  specification: string;

  @Column({ name: 'EVAL_METHOD', length: 200, nullable: true })
  evalMethod: string;

  @Column({ name: 'SAMPLE_SIZE', length: 50, nullable: true })
  sampleSize: string;

  @Column({ name: 'SAMPLE_FREQ', length: 100, nullable: true })
  sampleFreq: string;

  @Column({ name: 'CONTROL_METHOD', length: 200, nullable: true })
  controlMethod: string;

  @Column({ name: 'REACTION_PLAN', length: 500, nullable: true })
  reactionPlan: string;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
