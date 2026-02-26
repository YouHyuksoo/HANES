/**
 * @file entities/pm-plan-item.entity.ts
 * @description PM 계획 세부항목 엔티티
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. pmPlanCode: 부모 PM 계획의 planCode
 * 3. 항목 유형: CHECK(점검), REPLACE(교체), CLEAN(청소), ADJUST(조정), LUBRICATE(윤활)
 * 4. sparePartCode/sparePartQty: 필요 예비부품 관리
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PmPlan } from './pm-plan.entity';

@Entity({ name: 'PM_PLAN_ITEMS' })
@Index(['pmPlanCode'])
export class PmPlanItem {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'PM_PLAN_ID', length: 50 })
  pmPlanCode: string;

  @Column({ name: 'SEQ', type: 'number' })
  seq: number;

  @Column({ name: 'ITEM_NAME', length: 200 })
  itemName: string;

  @Column({ name: 'ITEM_TYPE', length: 20, default: 'CHECK' })
  itemType: string;

  @Column({ name: 'DESCRIPTION', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'CRITERIA', length: 500, nullable: true })
  criteria: string | null;

  @Column({ name: 'SPARE_PART_CODE', length: 50, nullable: true })
  sparePartCode: string | null;

  @Column({ name: 'SPARE_PART_QTY', type: 'number', default: 0 })
  sparePartQty: number;

  @Column({ name: 'ESTIMATED_MINUTES', type: 'number', nullable: true })
  estimatedMinutes: number | null;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => PmPlan, (plan) => plan.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'PM_PLAN_ID', referencedColumnName: 'planCode' })
  pmPlan: PmPlan;
}
