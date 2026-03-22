/**
 * @file entities/shift-pattern.entity.ts
 * @description 교대 패턴 마스터 엔티티 - 근무 교대(Shift) 정보를 관리한다.
 *              COMPANY + PLANT_CD + SHIFT_CODE 복합키를 PK로 사용한다.
 *
 * 초보자 가이드:
 * 1. 복합 PK: (COMPANY, PLANT_CD, SHIFT_CODE) — 공장별 교대 패턴 구분
 * 2. START_TIME / END_TIME: "HH:MM" 형식 (예: "08:00", "17:00")
 * 3. BREAK_MINUTES: 휴게 시간(분), WORK_MINUTES: 실작업 시간(분)
 * 4. USE_YN: 사용 여부 ('Y'/'N')
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'SHIFT_PATTERNS' })
@Index(['useYn'])
export class ShiftPattern {
  @PrimaryColumn({ name: 'COMPANY', length: 50 })
  company: string;

  @PrimaryColumn({ name: 'PLANT_CD', length: 50 })
  plant: string;

  @PrimaryColumn({ name: 'SHIFT_CODE', length: 20 })
  shiftCode: string;

  @Column({ name: 'SHIFT_NAME', length: 100 })
  shiftName: string;

  @Column({ name: 'START_TIME', length: 5 })
  startTime: string;

  @Column({ name: 'END_TIME', length: 5 })
  endTime: string;

  @Column({ name: 'BREAK_MINUTES', type: 'number', precision: 4, default: 60 })
  breakMinutes: number;

  @Column({ name: 'WORK_MINUTES', type: 'number', precision: 5, default: 0 })
  workMinutes: number;

  @Column({ name: 'SORT_ORDER', type: 'number', precision: 3, default: 0 })
  sortOrder: number;

  @Column({ name: 'USE_YN', length: 1, default: 'Y' })
  useYn: string;

  @Column({ name: 'CREATED_BY', length: 50, nullable: true })
  createdBy: string | null;

  @Column({ name: 'UPDATED_BY', length: 50, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
