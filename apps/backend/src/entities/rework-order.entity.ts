/**
 * @file rework-order.entity.ts
 * @description 재작업 지시 엔티티 — IATF 16949 8.7.1 부적합 출력물 재작업 관리
 *
 * 초보자 가이드:
 * 1. DefectLog에서 재작업 판정된 불량품에 대한 재작업 지시를 관리
 * 2. 2단계 승인: 품질담당 → 생산담당 순서로 승인
 * 3. 상태 흐름: REGISTERED → QC_PENDING → ... → PASS/FAIL/SCRAP
 */
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { DefectLog } from './defect-log.entity';

@Entity('rework_orders')
@Index(['company', 'plant', 'status'])
@Index(['company', 'plant', 'reworkNo'], { unique: true })
export class ReworkOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rework_no', length: 30 })
  reworkNo: string;

  @Column({ name: 'defect_log_id', nullable: true })
  defectLogId: number;

  @ManyToOne(() => DefectLog, { nullable: true })
  @JoinColumn({ name: 'defect_log_id' })
  defectLog: DefectLog;

  @Column({ name: 'item_code', length: 50 })
  itemCode: string;

  @Column({ name: 'item_name', length: 200, nullable: true })
  itemName: string;

  @Column({ name: 'prd_uid', length: 80, nullable: true })
  prdUid: string;

  @Column({ name: 'rework_qty', type: 'int', default: 0 })
  reworkQty: number;

  @Column({ name: 'defect_type', length: 50, nullable: true })
  defectType: string;

  @Column({ name: 'rework_method', length: 500, nullable: true })
  reworkMethod: string;

  @Column({ name: 'status', length: 30, default: 'REGISTERED' })
  @Index()
  status: string;

  @Column({ name: 'qc_approver_code', length: 50, nullable: true })
  qcApproverCode: string;

  @Column({ name: 'qc_approved_at', type: 'timestamptz', nullable: true })
  qcApprovedAt: Date;

  @Column({ name: 'qc_reject_reason', length: 500, nullable: true })
  qcRejectReason: string;

  @Column({ name: 'prod_approver_code', length: 50, nullable: true })
  prodApproverCode: string;

  @Column({ name: 'prod_approved_at', type: 'timestamptz', nullable: true })
  prodApprovedAt: Date;

  @Column({ name: 'prod_reject_reason', length: 500, nullable: true })
  prodRejectReason: string;

  @Column({ name: 'worker_code', length: 50, nullable: true })
  workerCode: string;

  @Column({ name: 'line_code', length: 50, nullable: true })
  lineCode: string;

  @Column({ name: 'equip_code', length: 50, nullable: true })
  equipCode: string;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date;

  @Column({ name: 'result_qty', type: 'int', default: 0 })
  resultQty: number;

  @Column({ name: 'pass_qty', type: 'int', default: 0 })
  passQty: number;

  @Column({ name: 'fail_qty', type: 'int', default: 0 })
  failQty: number;

  @Column({ name: 'isolation_flag', type: 'boolean', default: true })
  isolationFlag: boolean;

  @Column({ name: 'remarks', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl: string;

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
