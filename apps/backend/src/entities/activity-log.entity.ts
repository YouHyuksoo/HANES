/**
 * @file entities/activity-log.entity.ts
 * @description 사용자 활동 로그 엔티티 - 로그인/페이지 접속 기록
 *
 * 초보자 가이드:
 * 1. activityDate + seq: 복합 PK (활동일자 + 일련번호)
 * 2. activityType: LOGIN, PAGE_ACCESS, TOAST_SUCCESS, TOAST_ERROR, API_CALL, API_ERROR, JS_ERROR, SCAN
 * 3. deviceType: PC 또는 PDA 디바이스 구분
 * 4. SYS_CONFIGS의 ENABLE_ACTIVITY_LOG 설정이 'Y'일 때만 기록.
 *    단 에러 3종(TOAST_ERROR/API_ERROR/JS_ERROR)은 설정과 무관하게 항상 기록한다.
 * 5. seq는 SEQ_ACTIVITY_LOG 시퀀스로 채번한다(서비스에서 주입). 기본값 1에 의존하면
 *    같은 날 2번째 insert가 ORA-00001로 죽는다 — 2026-09-12 이전의 실제 결함.
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

  @Column({ name: 'EMAIL', length: 255 })
  userEmail: string;

  @Column({ type: 'varchar2', name: 'NAME', length: 255, nullable: true })
  userName: string | null;

  /** LOGIN | PAGE_ACCESS | TOAST_SUCCESS | TOAST_ERROR | API_CALL | API_ERROR | JS_ERROR | SCAN */
  @Column({ name: 'ACTIVITY_TYPE', length: 50 })
  activityType: string;

  /** 토스트/에러 메시지 본문 — 실패 원인 분석의 핵심 필드 */
  @Column({ type: 'varchar2', name: 'MESSAGE', length: 2000, nullable: true })
  message: string | null;

  /** HUMAN(사람 조작) | SCENARIO(시나리오 드라이버) */
  @Column({ type: 'varchar2', name: 'ACTOR_KIND', length: 20, default: 'HUMAN' })
  actorKind: string;

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

  @Column({ type: 'varchar2', name: 'COMPANY', length: 50 })
  company: string;

  @Column({ type: 'varchar2', name: 'PLANT_CD', length: 50 })
  plant: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;
}
