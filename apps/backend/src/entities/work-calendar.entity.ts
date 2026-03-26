/**
 * @file entities/work-calendar.entity.ts
 * @description 월력(Work Calendar) 헤더 엔티티 - 연간/공정별 근무 일정 헤더를 관리한다.
 *              CALENDAR_ID를 자연키 PK로 사용한다 (예: "WC-2026-PLANT01").
 *
 * 초보자 가이드:
 * 1. CALENDAR_ID가 PK — 연도+공장 조합의 자연키
 * 2. PROCESS_CD: 특정 공정 전용 월력일 때 설정 (null이면 공장 공통)
 * 3. DEFAULT_SHIFTS: CSV 형태로 교대 패턴 코드 나열 (예: "DAY,NIGHT")
 * 4. STATUS: 'DRAFT' → 'ACTIVE' 등 상태 관리
 * 5. UQ_WORK_CAL_YEAR_PROC: 동일 회사/공장/연도/공정 중복 방지
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ProcessMaster } from './process-master.entity';

@Entity({ name: 'WORK_CALENDARS' })
@Index(['company', 'plant', 'calendarYear'])
@Index(['processCd'])
@Unique('UQ_WORK_CAL_YEAR_PROC', ['company', 'plant', 'calendarYear', 'processCd'])
export class WorkCalendar {
  @PrimaryColumn({ name: 'CALENDAR_ID', length: 50 })
  calendarId: string;

  @Column({ name: 'CALENDAR_YEAR', length: 4 })
  calendarYear: string;

  @Column({ type: 'varchar2', name: 'PROCESS_CD', length: 50, nullable: true })
  processCd: string | null;

  @Column({ name: 'DEFAULT_SHIFT_COUNT', type: 'number', precision: 1, default: 1 })
  defaultShiftCount: number;

  @Column({ type: 'varchar2', name: 'DEFAULT_SHIFTS', length: 100, nullable: true })
  defaultShifts: string | null;

  @Column({ name: 'STATUS', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ type: 'varchar2', name: 'REMARK', length: 500, nullable: true })
  remark: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @Column({ type: 'varchar2', name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar2', name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;

  /* ── Relations ── */

  @ManyToOne(() => ProcessMaster, { nullable: true })
  @JoinColumn({ name: 'PROCESS_CD', referencedColumnName: 'processCode' })
  process: ProcessMaster | null;
}
