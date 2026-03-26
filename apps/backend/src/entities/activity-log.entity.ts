/**
 * @file entities/activity-log.entity.ts
 * @description 사용자 활동 로그 엔티티 - 로그인/페이지 접속 기록
 *
 * 초보자 가이드:
 * 1. activityDate + seq: 복합 PK (활동일자 + 일련번호)
 * 2. activityType: LOGIN(로그인), PAGE_ACCESS(페이지 접속)
 * 3. deviceType: PC 또는 PDA 디바이스 구분
 * 4. SYS_CONFIGS의 ENABLE_ACTIVITY_LOG 설정이 'Y'일 때만 기록
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'ACTIVITY_LOGS' })
@Index(['userEmail'])
@Index(['activityType'])
@Index(['createdAt'])
export class ActivityLog {
  @PrimaryColumn({ name: 'ACTIVITY_DATE', type: 'date', default: () => 'SYSDATE' })
  activityDate: Date;

  @PrimaryColumn({ name: 'SEQ', type: 'int', default: 1 })
  seq: number;

  @Column({ name: 'USER_EMAIL', length: 255 })
  userEmail: string;

  @Column({ type: 'varchar2', name: 'USER_NAME', length: 255, nullable: true })
  userName: string | null;

  /** LOGIN | PAGE_ACCESS */
  @Column({ name: 'ACTIVITY_TYPE', length: 50 })
  activityType: string;

  @Column({ type: 'varchar2', name: 'PAGE_PATH', length: 500, nullable: true })
  pagePath: string | null;

  @Column({ type: 'varchar2', name: 'PAGE_NAME', length: 200, nullable: true })
  pageName: string | null;

  @Column({ type: 'varchar2', name: 'IP_ADDRESS', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar2', name: 'USER_AGENT', length: 500, nullable: true })
  userAgent: string | null;

  /** PC | PDA */
  @Column({ type: 'varchar2', name: 'DEVICE_TYPE', length: 20, nullable: true })
  deviceType: string | null;

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
