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
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ReworkProcess } from './rework-process.entity';

@Entity('rework_results')
@Index(['company', 'plant', 'reworkProcessId'])
export class ReworkResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rework_process_id' })
  reworkProcessId: number;

  @ManyToOne(() => ReworkProcess)
  @JoinColumn({ name: 'rework_process_id' })
  reworkProcess: ReworkProcess;

  @Column({ name: 'worker_code', length: 50 })
  workerCode: string;

  @Column({ name: 'result_qty', type: 'int', default: 0 })
  resultQty: number;

  @Column({ name: 'good_qty', type: 'int', default: 0 })
  goodQty: number;

  @Column({ name: 'defect_qty', type: 'int', default: 0 })
  defectQty: number;

  @Column({ name: 'work_detail', length: 2000 })
  workDetail: string;

  @Column({ name: 'work_time_min', type: 'int', nullable: true })
  workTimeMin: number;

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
