/**
 * @file rework-result.entity.ts
 * @description 재작업 공정별 실적 엔티티 — IATF 16949 작업내역 기록
 *
 * 초보자 가이드:
 * 1. ReworkProcess 하위의 실적 기록
 * 2. 작업자, 수량, 양품/불량, 작업내역, 시간 기록
 * 3. IATF 16949: 재작업 처리 결과를 상세 기록
 */
import {
  Entity, PrimaryColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ReworkProcess } from './rework-process.entity';

@Entity({ name: 'REWORK_RESULTS' })
@Index(['company', 'plant', 'reworkOrderId', 'processCode'])
export class ReworkResult {
  @PrimaryColumn({ name: 'REWORK_ORDER_ID' })
  reworkOrderId: number;

  @PrimaryColumn({ name: 'PROCESS_CODE', length: 50 })
  processCode: string;

  @PrimaryColumn({ name: 'SEQ', type: 'int' })
  seq: number;

  @ManyToOne(() => ReworkProcess)
  @JoinColumn([
    { name: 'REWORK_ORDER_ID', referencedColumnName: 'reworkOrderId' },
    { name: 'PROCESS_CODE', referencedColumnName: 'processCode' },
  ])
  reworkProcess: ReworkProcess;

  @Column({ name: 'WORKER_CODE', length: 50 })
  workerId: string;

  @Column({ name: 'RESULT_QTY', type: 'int', default: 0 })
  resultQty: number;

  @Column({ name: 'GOOD_QTY', type: 'int', default: 0 })
  goodQty: number;

  @Column({ name: 'DEFECT_QTY', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'WORK_DETAIL', length: 2000 })
  workDetail: string;

  @Column({ name: 'WORK_TIME_MIN', type: 'int', nullable: true })
  workTimeMin: number;

  @Column({ name: 'START_AT', type: 'timestamp', nullable: true })
  startAt: Date;

  @Column({ name: 'END_AT', type: 'timestamp', nullable: true })
  endAt: Date;

  @Column({ name: 'REMARKS', length: 1000, nullable: true })
  remarks: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

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
