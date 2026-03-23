/**
 * @file entities/pm-wo-result.entity.ts
 * @description PM Work Order 실행 결과 엔티티 — 복합 PK(workOrderNo + seq)
 *
 * 초보자 가이드:
 * 1. 복합 PK: workOrderNo + seq (부모 FK + 순번)
 * 2. workOrderNo: 부모 WO의 WORK_ORDER_NO (string)
 * 3. 항목 유형: CHECK, REPLACE, CLEAN, ADJUST, LUBRICATE
 * 4. result: PASS / FAIL
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PmWorkOrder } from './pm-work-order.entity';

@Entity({ name: 'PM_WO_RESULTS' })
export class PmWoResult {
  @PrimaryColumn({ name: 'WORK_ORDER_NO', length: 20 })
  workOrderNo: string;

  @Column({ name: 'PM_PLAN_ITEM_ID', type: 'number', nullable: true })
  pmPlanItemId: number | null;

  @PrimaryColumn({ name: 'SEQ', type: 'number' })
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
  @JoinColumn({ name: 'WORK_ORDER_NO', referencedColumnName: 'workOrderNo' })
  workOrder: PmWorkOrder;
}
