/**
 * @file entities/pm-work-order.entity.ts
 * @description PM Work Order(작업지시) 엔티티
 *
 * 초보자 가이드:
 * 1. **WO 유형**: PLANNED(계획), EMERGENCY(긴급), BREAKDOWN(고장)
 * 2. **상태 흐름**: PLANNED → IN_PROGRESS → COMPLETED / CANCELLED / OVERDUE
 * 3. **details**: CLOB JSON - 항목별 실행 결과 저장
 * 4. **채번 규칙**: PM-YYYYMMDD-NNN (일별 시퀀스)
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  AfterLoad,
} from 'typeorm';
import { PmWoResult } from './pm-wo-result.entity';

@Entity({ name: 'PM_WORK_ORDERS' })
@Index(['equipId'])
@Index(['status'])
@Index(['scheduledDate'])
export class PmWorkOrder {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'WORK_ORDER_NO', length: 20, unique: true })
  workOrderNo: string;

  @Column({ name: 'PM_PLAN_ID', type: 'raw', length: 16, nullable: true })
  pmPlanId: string | null;

  @Column({ name: 'EQUIP_ID', length: 255 })
  equipId: string;

  @Column({ name: 'WO_TYPE', length: 20, default: 'PLANNED' })
  woType: string;

  @Column({ name: 'SCHEDULED_DATE', type: 'date' })
  scheduledDate: Date;

  @Column({ name: 'DUE_DATE', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'STARTED_AT', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'COMPLETED_AT', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'STATUS', length: 20, default: 'PLANNED' })
  status: string;

  @Column({ name: 'PRIORITY', length: 10, default: 'MEDIUM' })
  priority: string;

  @Column({ name: 'ASSIGNED_WORKER_ID', length: 255, nullable: true })
  assignedWorkerId: string | null;

  @Column({ name: 'OVERALL_RESULT', length: 20, nullable: true })
  overallResult: string | null;

  @Column({ name: 'DETAILS', type: 'clob', nullable: true })
  details: string | null;

  @Column({ name: 'REMARK', length: 1000, nullable: true })
  remark: string | null;

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

  @OneToMany(() => PmWoResult, (result) => result.workOrder, { cascade: true })
  results: PmWoResult[];

  @AfterLoad()
  convertRawIds() {
    if (Buffer.isBuffer(this.id)) this.id = (this.id as any).toString('hex').toUpperCase();
    if (Buffer.isBuffer(this.pmPlanId)) this.pmPlanId = (this.pmPlanId as any).toString('hex').toUpperCase();
  }
}
