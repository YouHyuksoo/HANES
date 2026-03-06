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
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ReworkOrder } from './rework-order.entity';

@Entity('rework_processes')
@Index(['company', 'plant', 'reworkOrderId'])
export class ReworkProcess {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rework_order_id' })
  reworkOrderId: number;

  @ManyToOne(() => ReworkOrder)
  @JoinColumn({ name: 'rework_order_id' })
  reworkOrder: ReworkOrder;

  @Column({ name: 'process_code', length: 50 })
  processCode: string;

  @Column({ name: 'process_name', length: 200 })
  processName: string;

  @Column({ name: 'seq', type: 'int' })
  seq: number;

  @Column({ name: 'status', length: 30, default: 'WAITING' })
  status: string;

  @Column({ name: 'worker_code', length: 50, nullable: true })
  workerCode: string;

  @Column({ name: 'line_code', length: 50, nullable: true })
  lineCode: string;

  @Column({ name: 'equip_code', length: 50, nullable: true })
  equipCode: string;

  @Column({ name: 'plan_qty', type: 'int', default: 0 })
  planQty: number;

  @Column({ name: 'result_qty', type: 'int', default: 0 })
  resultQty: number;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date;

  @Column({ name: 'remarks', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'company', type: 'int' })
  company: number;

  @Column({ name: 'plant', length: 20 })
  plant: string;

  @Column({ name: 'created_by', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
