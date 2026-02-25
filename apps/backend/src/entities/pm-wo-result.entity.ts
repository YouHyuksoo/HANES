/**
 * @file entities/pm-wo-result.entity.ts
 * @description PM Work Order 실행 결과 엔티티 (정규화 테이블)
 *              SEQUENCE(패턴 B)를 사용한다.
 *
 * 초보자 가이드:
 * 1. id가 자동증가 PK (SEQUENCE)
 * 2. workOrderId: 부모 WO의 ID (number)
 * 3. 항목 유형: CHECK, REPLACE, CLEAN, ADJUST, LUBRICATE
 * 4. result: PASS / FAIL
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
import { PmWorkOrder } from './pm-work-order.entity';

@Entity({ name: 'PM_WO_RESULTS' })
@Index(['workOrderId'])
export class PmWoResult {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'WORK_ORDER_ID', type: 'number' })
  workOrderId: number;

  @Column({ name: 'PM_PLAN_ITEM_ID', type: 'number', nullable: true })
  pmPlanItemId: number | null;

  @Column({ name: 'SEQ', type: 'number' })
  seq: number;

  @Column({ name: 'ITEM_NAME', length: 200 })
  itemName: string;

  @Column({ name: 'ITEM_TYPE', length: 20, default: 'CHECK' })
  itemType: string;

  @Column({ name: 'CRITERIA', length: 500, nullable: true })
  criteria: string | null;

  @Column({ name: 'RESULT', length: 20 })
  result: string;

  @Column({ name: 'REMARK', length: 1000, nullable: true })
  remark: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => PmWorkOrder, (wo) => wo.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'WORK_ORDER_ID' })
  workOrder: PmWorkOrder;
}
