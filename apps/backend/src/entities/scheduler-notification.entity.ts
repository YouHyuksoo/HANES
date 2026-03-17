/**
 * @file entities/scheduler-notification.entity.ts
 * @description 스케줄러 알림 엔티티 - 작업 실행 결과에 따른 사용자 알림을 관리한다.
 *              복합키: COMPANY + NOTI_ID.
 *
 * 초보자 가이드:
 * 1. 복합 PK: company(회사) + notiId(알림 일련번호)
 * 2. notiType: 알림 유형 (FAIL / TIMEOUT / SUCCESS)
 * 3. isRead: 읽음 여부 ('Y' / 'N')
 * 4. job: SchedulerJob과 ManyToOne 관계 (company + plantCd + jobCode 복합 FK)
 * 5. userId: 알림 수신 대상 사용자 ID
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SchedulerJob } from './scheduler-job.entity';

@Entity({ name: 'SCHEDULER_NOTIFICATIONS' })
export class SchedulerNotification {
  @PrimaryColumn({ name: 'COMPANY', type: 'varchar2', length: 20 })
  company: string;

  @PrimaryColumn({ name: 'NOTI_ID', type: 'number' })
  notiId: number;

  @Column({ name: 'JOB_CODE', type: 'varchar2', length: 50 })
  jobCode: string;

  @Column({ name: 'PLANT_CD', type: 'varchar2', length: 20 })
  plantCd: string;

  /** 스케줄러 작업 (복합 FK) */
  @ManyToOne(() => SchedulerJob)
  @JoinColumn([
    { name: 'COMPANY', referencedColumnName: 'company' },
    { name: 'PLANT_CD', referencedColumnName: 'plantCd' },
    { name: 'JOB_CODE', referencedColumnName: 'jobCode' },
  ])
  job: SchedulerJob;

  /** 알림 수신 사용자 */
  @Column({ name: 'USER_ID', type: 'varchar2', length: 50 })
  userId: string;

  /** 알림 유형: FAIL / TIMEOUT / SUCCESS */
  @Column({ name: 'NOTI_TYPE', type: 'varchar2', length: 20 })
  notiType: string;

  /** 알림 메시지 */
  @Column({ name: 'MESSAGE', type: 'nvarchar2', length: 500 })
  message: string;

  /** 읽음 여부 ('Y' / 'N') */
  @Column({ name: 'IS_READ', type: 'char', length: 1, default: "'N'" })
  isRead: string;

  @CreateDateColumn({ name: 'CREATED_AT', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UPDATED_AT', type: 'timestamp' })
  updatedAt: Date;
}
