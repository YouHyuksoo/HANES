/**
 * @file entities/work-calendar-day.entity.ts
 * @description 월력 일자별 상세 엔티티 - 날짜별 근무 유형·교대·시간을 관리한다.
 *              CALENDAR_ID + WORK_DATE 복합키를 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. 복합 PK: (CALENDAR_ID, WORK_DATE) — 월력 헤더 + 날짜
 * 2. DAY_TYPE: 공통코드 WORK_DAY_TYPE (WORK, OFF, HALF 등)
 * 3. OFF_REASON: 공통코드 DAY_OFF_TYPE (HOLIDAY, ANNUAL 등)
 * 4. SHIFTS: CSV 형태 교대 코드 (예: "DAY,NIGHT")
 * 5. WORK_MINUTES / OT_MINUTES: 정규 근무·잔업 시간(분)
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'WORK_CALENDAR_DAYS' })
@Index(['workDate', 'dayType'])
export class WorkCalendarDay {
  @PrimaryColumn({ name: 'CALENDAR_ID', length: 50 })
  calendarId: string;

  @PrimaryColumn({ name: 'WORK_DATE', type: 'date' })
  workDate: string;

  @Column({ name: 'DAY_TYPE', length: 20, default: 'WORK' })
  dayType: string;

  @Column({ name: 'OFF_REASON', length: 20, nullable: true })
  offReason: string | null;

  @Column({ name: 'SHIFT_COUNT', type: 'number', precision: 1, default: 1 })
  shiftCount: number;

  @Column({ name: 'SHIFTS', length: 100, nullable: true })
  shifts: string | null;

  @Column({ name: 'WORK_MINUTES', type: 'number', precision: 5, default: 0 })
  workMinutes: number;

  @Column({ name: 'OT_MINUTES', type: 'number', precision: 5, default: 0 })
  otMinutes: number;

  @Column({ name: 'REMARK', length: 500, nullable: true })
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
}
