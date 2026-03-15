/**
 * @file training-result.entity.ts
 * @description 교육훈련 결과 엔티티 — 개인별 교육 참석/평가 기록
 *              복합 PK: planNo + workerCode
 *
 * 초보자 가이드:
 * 1. 복합 PK: planNo(교육계획번호) + workerCode(작업자코드)
 * 2. 평가 점수, 합격 여부, 자격증 번호, 유효기간 관리
 * 3. workerCode로 작업자별 교육 이력 조회 가능
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { TrainingPlan } from './training-plan.entity';

@Entity({ name: 'TRAINING_RESULTS' })
@Index(['workerCode'])
export class TrainingResult {
  @PrimaryColumn({ name: 'PLAN_NO', length: 50 })
  planNo: string;

  @ManyToOne(() => TrainingPlan)
  @JoinColumn({ name: 'PLAN_NO', referencedColumnName: 'planNo' })
  plan: TrainingPlan;

  @PrimaryColumn({ name: 'WORKER_CODE', length: 50 })
  workerCode: string;

  @Column({ name: 'WORKER_NAME', length: 100 })
  workerName: string;

  @Column({ name: 'ATTEND_DATE', type: 'timestamp', nullable: true })
  attendDate: Date;

  @Column({ name: 'SCORE', type: 'int', nullable: true })
  score: number;

  @Column({ name: 'PASSED', type: 'number', default: 0 })
  passed: number;

  @Column({ name: 'CERTIFICATE_NO', length: 100, nullable: true })
  certificateNo: string;

  @Column({ name: 'VALID_UNTIL', type: 'timestamp', nullable: true })
  validUntil: Date;

  @Column({ name: 'REMARKS', length: 500, nullable: true })
  remarks: string;

  @Column({ name: 'COMPANY', length: 50 })
  company: string;

  @Column({ name: 'PLANT', length: 20 })
  plant: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'CREATED_AT' })
  createdAt: Date;
}
