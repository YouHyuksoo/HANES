/**
 * @file training-plan.entity.ts
 * @description 교육훈련 계획 엔티티 — IATF 16949 7.2 적격성(교육훈련)
 *
 * 초보자 가이드:
 * 1. 직원 교육훈련 계획 등록 및 관리
 * 2. 상태 흐름: PLANNED → IN_PROGRESS → COMPLETED / CANCELLED
 * 3. planNo 자동채번: TRN-YYYYMMDD-NNN
 * 4. TrainingResult 엔티티와 1:N 관계 (교육 참석 결과)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'TRAINING_PLANS' })
export class TrainingPlan {
  @PrimaryColumn({ name: 'PLAN_NO', length: 50 })
  planNo: string;

  @Column({ name: 'TITLE', length: 200 })
  title: string;

  @Column({ name: 'TRAINING_TYPE', length: 30 })
  trainingType: string;

  @Column({ name: 'TARGET_ROLE', length: 100, nullable: true })
  targetRole: string;

  @Column({ name: 'INSTRUCTOR', length: 100, nullable: true })
  instructor: string;

  @Column({ name: 'SCHEDULED_DATE', type: 'timestamp', nullable: true })
  scheduledDate: Date;

  @Column({ name: 'DURATION', type: 'int', nullable: true })
  duration: number;

  @Column({ name: 'MAX_PARTICIPANTS', type: 'int', nullable: true })
  maxParticipants: number;

  @Column({ name: 'STATUS', length: 20, default: 'PLANNED' })
  status: string;

  @Column({ name: 'DESCRIPTION', length: 2000, nullable: true })
  description: string;

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
