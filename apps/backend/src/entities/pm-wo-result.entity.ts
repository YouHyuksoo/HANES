/**
 * @file entities/pm-wo-result.entity.ts
 * @description PM Work Order 실행 결과 엔티티 (정규화 테이블)
 *
 * 초보자 가이드:
 * 1. **역할**: WO 실행 시 항목별 PASS/FAIL 결과를 저장
 * 2. **관계**: ManyToOne → PmWorkOrder (부모 WO)
 * 3. **이전 방식**: PM_WORK_ORDERS.DETAILS CLOB에 JSON으로 저장했으나,
 *    정규화를 위해 별도 테이블로 분리
 * 4. **항목 유형**: CHECK, REPLACE, CLEAN, ADJUST, LUBRICATE
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
  AfterLoad,
} from 'typeorm';
import { PmWorkOrder } from './pm-work-order.entity';

@Entity({ name: 'PM_WO_RESULTS' })
@Index(['workOrderId'])
export class PmWoResult {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'WORK_ORDER_ID', type: 'raw', length: 16 })
  workOrderId: string;

  @Column({ name: 'PM_PLAN_ITEM_ID', type: 'raw', length: 16, nullable: true })
  pmPlanItemId: string | null;

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

  @AfterLoad()
  convertRawIds() {
    if (Buffer.isBuffer(this.id)) this.id = (this.id as any).toString('hex').toUpperCase();
    if (Buffer.isBuffer(this.workOrderId)) this.workOrderId = (this.workOrderId as any).toString('hex').toUpperCase();
    if (Buffer.isBuffer(this.pmPlanItemId)) this.pmPlanItemId = (this.pmPlanItemId as any).toString('hex').toUpperCase();
  }
}
