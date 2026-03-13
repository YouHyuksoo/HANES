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

@Entity({ name: 'REWORK_ORDERS' })
@Index(['company', 'plant', 'status'])
@Index(['company', 'plant', 'reworkNo'], { unique: true })
export class ReworkOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'REWORK_NO', length: 30 })
  reworkNo: string;

  @Column({ name: 'DEFECT_LOG_ID', nullable: true })
  defectLogId: number;

  @ManyToOne(() => DefectLog, { nullable: true })
  @JoinColumn({ name: 'DEFECT_LOG_ID' })
  defectLog: DefectLog;

  @Column({ name: 'ITEM_CODE', length: 50 })
  itemCode: string;

  @Column({ name: 'ITEM_NAME', length: 200, nullable: true })
  itemName: string;

  @Column({ name: 'PRD_UID', length: 80, nullable: true })
  prdUid: string;

  @Column({ name: 'REWORK_QTY', type: 'int', default: 0 })
  reworkQty: number;

  @Column({ name: 'DEFECT_TYPE', length: 50, nullable: true })
  defectType: string;

  @Column({ name: 'REWORK_METHOD', length: 500, nullable: true })
  reworkMethod: string;

  @Column({ name: 'STATUS', length: 30, default: 'REGISTERED' })
  @Index()
  status: string;

  @Column({ name: 'QC_APPROVER_CODE', length: 50, nullable: true })
  qcApproverCode: string;

  @Column({ name: 'QC_APPROVED_AT', type: 'timestamp', nullable: true })
  qcApprovedAt: Date;

  @Column({ name: 'QC_REJECT_REASON', length: 500, nullable: true })
  qcRejectReason: string;

  @Column({ name: 'PROD_APPROVER_CODE', length: 50, nullable: true })
  prodApproverCode: string;

  @Column({ name: 'PROD_APPROVED_AT', type: 'timestamp', nullable: true })
  prodApprovedAt: Date;

  @Column({ name: 'PROD_REJECT_REASON', length: 500, nullable: true })
  prodRejectReason: string;

  @Column({ name: 'WORKER_CODE', length: 50, nullable: true })
  workerCode: string;

  @Column({ name: 'LINE_CODE', length: 50, nullable: true })
  lineCode: string;

  @Column({ name: 'EQUIP_CODE', length: 50, nullable: true })
  equipCode: string;

  @Column({ name: 'START_AT', type: 'timestamp', nullable: true })
  startAt: Date;

  @Column({ name: 'END_AT', type: 'timestamp', nullable: true })
  endAt: Date;

  @Column({ name: 'RESULT_QTY', type: 'int', default: 0 })
  resultQty: number;

  @Column({ name: 'PASS_QTY', type: 'int', default: 0 })
  passQty: number;

  @Column({ name: 'FAIL_QTY', type: 'int', default: 0 })
  failQty: number;

  @Column({ name: 'ISOLATION_FLAG', type: 'number', default: 1 })
  isolationFlag: number;

  @Column({ name: 'REMARKS', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'IMAGE_URL', length: 500, nullable: true })
  imageUrl: string;

  @Column({ name: 'COMPANY', type: 'int' })
  company: number;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT' })
  updatedAt: Date;
}
