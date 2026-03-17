/**
 * @file src/modules/scheduler/services/scheduler-noti.service.ts
 * @description 스케줄러 알림 서비스 - 작업 실행 결과 알림 생성/조회/읽음처리를 관리한다.
 *
 * 초보자 가이드:
 * 1. **generateNotiId()**: company 범위 내에서 MAX(NOTI_ID)+1 채번
 * 2. **createNotification()**: 실행 실패/타임아웃 시 관리자에게 알림 생성
 * 3. **findByUser()**: 특정 사용자의 최근 알림 목록 조회
 * 4. **getUnreadCount()**: 읽지 않은 알림 개수 (헤더 벨 아이콘 뱃지용)
 * 5. **markAsRead()**: 개별 알림 읽음 처리
 * 6. **markAllAsRead()**: 사용자의 모든 미읽음 알림 일괄 읽음 처리
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SchedulerNotification } from '../../../entities/scheduler-notification.entity';

@Injectable()
export class SchedulerNotiService {
  private readonly logger = new Logger(SchedulerNotiService.name);

  constructor(
    @InjectRepository(SchedulerNotification)
    private readonly notiRepo: Repository<SchedulerNotification>,
    private readonly dataSource: DataSource,
  ) {}

  // =============================================
  // 채번
  // =============================================

  /**
   * NOTI_ID 채번: company 범위 내 MAX+1
   * @param company 회사코드
   * @returns 다음 NOTI_ID
   */
  async generateNotiId(company: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT NVL(MAX("NOTI_ID"), 0) + 1 AS "nextId"
         FROM "SCHEDULER_NOTIFICATIONS"
        WHERE "COMPANY" = :1`,
      [company],
    );
    return result[0].nextId;
  }

  // =============================================
  // CRUD
  // =============================================

  /**
   * 알림 생성 (notiId 자동 채번)
   * @param data 알림 데이터
   * @returns 생성된 알림
   */
  async createNotification(
    data: Partial<SchedulerNotification>,
  ): Promise<SchedulerNotification> {
    const company = data.company!;
    const notiId = await this.generateNotiId(company);

    const noti = this.notiRepo.create({
      ...data,
      notiId,
      isRead: 'N',
    });

    const saved = await this.notiRepo.save(noti);
    this.logger.log(`알림 생성: company=${company}, notiId=${notiId}, userId=${data.userId}`);
    return saved;
  }

  /**
   * 특정 사용자의 최근 알림 목록 조회
   * @param userId 사용자 ID
   * @param company 회사코드
   * @param limit 조회 건수 (기본 20)
   */
  async findByUser(
    userId: string,
    company: string,
    limit: number = 20,
  ): Promise<SchedulerNotification[]> {
    return this.notiRepo.find({
      where: { userId, company },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 읽지 않은 알림 개수 조회
   * @param userId 사용자 ID
   * @param company 회사코드
   */
  async getUnreadCount(userId: string, company: string): Promise<number> {
    return this.notiRepo.count({
      where: { userId, company, isRead: 'N' },
    });
  }

  /**
   * 개별 알림 읽음 처리
   * @param company 회사코드
   * @param notiId 알림 ID
   */
  async markAsRead(company: string, notiId: number): Promise<void> {
    await this.notiRepo.update(
      { company, notiId },
      { isRead: 'Y' },
    );
  }

  /**
   * 사용자의 모든 미읽음 알림 일괄 읽음 처리
   * @param userId 사용자 ID
   * @param company 회사코드
   */
  async markAllAsRead(userId: string, company: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "SCHEDULER_NOTIFICATIONS"
          SET "IS_READ" = 'Y'
        WHERE "COMPANY" = :1 AND "USER_ID" = :2 AND "IS_READ" = 'N'`,
      [company, userId],
    );
    this.logger.log(`알림 일괄 읽음 처리: company=${company}, userId=${userId}`);
  }
}
