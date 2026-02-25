/**
 * @file entities/pm-plan.entity.ts
 * @description PM(예방보전) 계획 마스터 엔티티
 *              planCode를 자연키 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. planCode가 PK (UUID 대신 자연키)
 * 2. equipCode: 대상 설비 코드
 * 3. cycleType + cycleValue로 nextDueAt 자동 계산
 * 4. items: PM 계획 세부항목 (1:N)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { PmPlanItem } from './pm-plan-item.entity';

@Entity({ name: 'PM_PLANS' })
@Index(['equipCode'])
@Index(['nextDueAt'])
export class PmPlan {
  @PrimaryColumn({ name: 'PLAN_CODE', length: 50 })
  planCode: string;

  @Column({ name: 'EQUIP_CODE', length: 50 })
  equipCode: string;

  @Column({ name: 'PLAN_NAME', length: 200 })
  planName: string;

  @Column({ name: 'PM_TYPE', length: 20, default: 'TIME_BASED' })
  pmType: string;

  @Column({ name: 'CYCLE_TYPE', length: 20, default: 'MONTHLY' })
  cycleType: string;

  @Column({ name: 'CYCLE_VALUE', type: 'number', default: 1 })
  cycleValue: number;

  @Column({ name: 'CYCLE_UNIT', length: 10, default: 'MONTH' })
  cycleUnit: string;

  @Column({ name: 'SEASON_MONTH', type: 'number', nullable: true })
  seasonMonth: number | null;

  @Column({ name: 'ESTIMATED_TIME', type: 'number', nullable: true })
  estimatedTime: number | null;

  @Column({ name: 'DESCRIPTION', length: 1000, nullable: true })
  description: string | null;

  @Column({ name: 'LAST_EXECUTED_AT', type: 'timestamp', nullable: true })
  lastExecutedAt: Date | null;

  @Column({ name: 'NEXT_DUE_AT', type: 'timestamp', nullable: true })
  nextDueAt: Date | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

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

  @OneToMany(() => PmPlanItem, (item) => item.pmPlan, { cascade: true })
  items: PmPlanItem[];
}
