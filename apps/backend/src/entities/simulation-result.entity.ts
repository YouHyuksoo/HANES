/**
 * @file entities/simulation-result.entity.ts
 * @description 시뮬레이션 결과 정규화 엔티티 3종 (헤더/계획/스케줄)
 *
 * 초보자 가이드:
 * 1. SimulationHeader: 시뮬레이션 실행 단위 (SIM_ID PK)
 * 2. SimulationPlan: 계획별 결과 (SIM_ID + PLAN_NO 복합키)
 * 3. SimulationSchedule: 일자별 스케줄 (SIM_ID + WORK_DATE + PLAN_NO + PROCESS_CODE 복합키)
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

@Entity({ name: 'SIMULATION_HEADERS' })
export class SimulationHeader {
  @PrimaryColumn({ name: 'SIM_ID', length: 50 })
  simId: string;

  @Column({ name: 'SIM_MONTH', length: 7 })
  simMonth: string;

  @Column({ name: 'STRATEGY', length: 20, default: 'DUE_DATE' })
  strategy: string;

  @Column({ name: 'SHIFT_COUNT', type: 'number', precision: 1, default: 1 })
  shiftCount: number;

  @Column({ name: 'INCLUDE_OT', length: 1, default: 'N' })
  includeOt: string;

  @Column({ name: 'APPLY_SETUP', length: 1, default: 'Y' })
  applySetup: string;

  @Column({ name: 'DEDUCT_STOCK', length: 1, default: 'N' })
  deductStock: string;

  @Column({ name: 'TOTAL_PLANS', type: 'number', default: 0 })
  totalPlans: number;

  @Column({ name: 'ON_TIME_COUNT', type: 'number', default: 0 })
  onTimeCount: number;

  @Column({ name: 'DELAY_COUNT', type: 'number', default: 0 })
  delayCount: number;

  @Column({ name: 'TOTAL_QTY', type: 'number', default: 0 })
  totalQty: number;

  @Column({ name: 'WORK_DAYS', type: 'number', default: 0 })
  workDays: number;

  @Column({ name: 'UTILIZATION_RATE', type: 'decimal', precision: 5, scale: 1, default: 0 })
  utilizationRate: number;

  @Column({ name: 'REQUIRED_HOURS', type: 'decimal', precision: 10, scale: 1, default: 0 })
  requiredHours: number;

  @Column({ name: 'AVAILABLE_HOURS', type: 'decimal', precision: 10, scale: 1, default: 0 })
  availableHours: number;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => SimulationPlan, (p) => p.simId)
  plans: SimulationPlan[];

  @OneToMany(() => SimulationSchedule, (s) => s.simId)
  schedules: SimulationSchedule[];
}

@Entity({ name: 'SIMULATION_PLANS' })
export class SimulationPlan {
  @PrimaryColumn({ name: 'SIM_ID', length: 50 })
  simId: string;

  @PrimaryColumn({ name: 'PLAN_NO', length: 50 })
  planNo: string;

  @Column({ name: 'ITEM_CODE', length: 50, nullable: true })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string;

  @Column({ name: 'ITEM_TYPE', length: 20, nullable: true })
  itemType: string;

  @Column({ name: 'CUSTOMER', length: 50, nullable: true })
  customer: string;

  @Column({ name: 'CUSTOMER_NAME', length: 200, nullable: true })
  customerName: string;

  @Column({ name: 'PLAN_QTY', type: 'number', default: 0 })
  planQty: number;

  @Column({ name: 'DUE_DATE', length: 10, nullable: true })
  dueDate: string | null;

  @Column({ name: 'PRIORITY', type: 'number', default: 5 })
  priority: number;

  @Column({ name: 'START_DATE', length: 10, nullable: true })
  startDate: string;

  @Column({ name: 'END_DATE', length: 10, nullable: true })
  endDate: string;

  @Column({ name: 'ON_TIME', length: 1, default: 'Y' })
  onTime: string;

  @Column({ name: 'DELAY_DAYS', type: 'number', default: 0 })
  delayDays: number;

  @Column({ name: 'REQUIRED_DAYS', type: 'number', default: 0 })
  requiredDays: number;

  @Column({ name: 'BOTTLENECK_PROCESS', length: 100, nullable: true })
  bottleneckProcess: string;

  @Column({ name: 'DAILY_CAPA', type: 'number', default: 0 })
  dailyCapa: number;
}

@Entity({ name: 'SIMULATION_SCHEDULES' })
export class SimulationSchedule {
  @PrimaryColumn({ name: 'SIM_ID', length: 50 })
  simId: string;

  @PrimaryColumn({ name: 'PLAN_NO', length: 50 })
  planNo: string;

  @PrimaryColumn({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @Column({ name: 'PROCESS_NAME', length: 100, nullable: true })
  processName: string;

  @Column({ name: 'START_DATE', length: 10, nullable: true })
  startDate: string;

  @Column({ name: 'END_DATE', length: 10, nullable: true })
  endDate: string;

  @Column({ name: 'TOTAL_QTY', type: 'number', default: 0 })
  totalQty: number;
}
