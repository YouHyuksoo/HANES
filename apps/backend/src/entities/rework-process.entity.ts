/**
 * @file rework-process.entity.ts
 * @description 재작업 공정별 작업지시 엔티티 — ProcessMap 라우팅 연동
 *
 * 초보자 가이드:
 * 1. ReworkOrder 하위의 공정별 작업지시를 관리
 * 2. ProcessMap(품목 라우팅)에서 재작업할 공정을 선별 선택
 * 3. 상태: WAITING → IN_PROGRESS → COMPLETED / SKIPPED
 */
import {
  Entity, PrimaryColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ReworkOrder } from './rework-order.entity';
import { ProcessMaster } from './process-master.entity';

@Entity({ name: 'REWORK_PROCESSES' })
@Index(['company', 'plant', 'reworkOrderId'])
export class ReworkProcess {
  @PrimaryColumn({ name: 'REWORK_ORDER_ID', length: 50 })
  reworkOrderId: string;

  @ManyToOne(() => ReworkOrder)
  @JoinColumn({ name: 'REWORK_ORDER_ID', referencedColumnName: 'reworkNo' })
  reworkOrder: ReworkOrder;

  @PrimaryColumn({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @ManyToOne(() => ProcessMaster)
  @JoinColumn({ name: 'PROCESS_CODE', referencedColumnName: 'processCode' })
  process: ProcessMaster;

  @Column({ name: 'PROCESS_NAME', length: 200 })
  processName: string;

  @Column({ name: 'SEQ', type: 'int' })
  seq: number;

  @Column({ name: 'STATUS', length: 20, default: 'WAITING' })
  status: string;

  @Column({ name: 'WORKER_CODE', length: 50, nullable: true })
  workerId: string;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string;

  @Column({ name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string;

  @Column({ name: 'PLAN_QTY', type: 'int', default: 0 })
  planQty: number;

  @Column({ name: 'RESULT_QTY', type: 'int', default: 0 })
  resultQty: number;

  @Column({ name: 'START_AT', type: 'timestamp', nullable: true })
  startAt: Date;

  @Column({ name: 'END_AT', type: 'timestamp', nullable: true })
  endAt: Date;

  @Column({ name: 'REMARK', length: 500, nullable: true })
  remark: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
