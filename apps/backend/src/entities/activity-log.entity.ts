/**
 * @file src/entities/activity-log.entity.ts
 * @description 사용자 활동 로그 엔티티 - 로그인/페이지 접속 기록
 *
 * 초보자 가이드:
 * 1. **ACTIVITY_LOGS**: 사용자 로그인 및 페이지 접속 이력을 APPEND-ONLY로 저장
 * 2. **activityType**: LOGIN(로그인), PAGE_ACCESS(페이지 접속) 구분
 * 3. **deviceType**: PC 또는 PDA 디바이스 구분
 * 4. SYS_CONFIGS의 ENABLE_ACTIVITY_LOG 설정이 'Y'일 때만 기록됨
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'ACTIVITY_LOGS' })
@Index(['userId'])
@Index(['activityType'])
@Index(['createdAt'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid', { name: 'ID' })
  id: string;

  @Column({ name: 'USER_ID', length: 50 })
  userId: string;

  @Column({ name: 'USER_EMAIL', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ name: 'USER_NAME', length: 255, nullable: true })
  userName: string | null;

  /** LOGIN | PAGE_ACCESS */
  @Column({ name: 'ACTIVITY_TYPE', length: 50 })
  activityType: string;

  @Column({ name: 'PAGE_PATH', length: 500, nullable: true })
  pagePath: string | null;

  @Column({ name: 'PAGE_NAME', length: 200, nullable: true })
  pageName: string | null;

  @Column({ name: 'IP_ADDRESS', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'USER_AGENT', length: 500, nullable: true })
  userAgent: string | null;

  /** PC | PDA */
  @Column({ name: 'DEVICE_TYPE', length: 20, nullable: true })
  deviceType: string | null;

  @Column({ name: 'COMPANY', length: 50, nullable: true })
  company: string | null;

  @Column({ name: 'PLANT_CD', length: 50, nullable: true })
  plant: string | null;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
