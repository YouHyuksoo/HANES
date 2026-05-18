/**
 * @file src/modules/scheduler/services/scheduler-noti.service.ts
 * @description ?ㅼ?以꾨윭 ?뚮┝ ?쒕퉬??- ?묒뾽 ?ㅽ뻾 寃곌낵 ?뚮┝ ?앹꽦/議고쉶/?쎌쓬泥섎━瑜?愿由ы븳??
 *
 * 珥덈낫??媛?대뱶:
 * 1. **generateNotiId()**: company 踰붿쐞 ?댁뿉??MAX(NOTI_ID)+1 梨꾨쾲
 * 2. **createNotification()**: ?ㅽ뻾 ?ㅽ뙣/??꾩븘????愿由ъ옄?먭쾶 ?뚮┝ ?앹꽦
 * 3. **findByUser()**: ?뱀젙 ?ъ슜?먯쓽 理쒓렐 ?뚮┝ 紐⑸줉 議고쉶
 * 4. **getUnreadCount()**: ?쎌? ?딆? ?뚮┝ 媛쒖닔 (?ㅻ뜑 踰??꾩씠肄?諭껋???
 * 5. **markAsRead()**: 媛쒕퀎 ?뚮┝ ?쎌쓬 泥섎━
 * 6. **markAllAsRead()**: ?ъ슜?먯쓽 紐⑤뱺 誘몄씫???뚮┝ ?쇨큵 ?쎌쓬 泥섎━
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
  // 梨꾨쾲
  // =============================================

  /**
   * NOTI_ID 梨꾨쾲: company 踰붿쐞 ??MAX+1
   * @param company ?뚯궗肄붾뱶
   * @returns ?ㅼ쓬 NOTI_ID
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
   * ?뚮┝ ?앹꽦 (notiId ?먮룞 梨꾨쾲)
   * @param data ?뚮┝ ?곗씠??
   * @returns ?앹꽦???뚮┝
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
    this.logger.log(`?뚮┝ ?앹꽦: company=${company}, notiId=${notiId}, userId=${data.userId}`);
    return saved;
  }

  /**
   * ?뱀젙 ?ъ슜?먯쓽 理쒓렐 ?뚮┝ 紐⑸줉 議고쉶
   * @param userId ?ъ슜??ID
   * @param company ?뚯궗肄붾뱶
   * @param limit 議고쉶 嫄댁닔 (湲곕낯 20)
   */
  async findByUser(
    userId: string,
    company: string,
    plant: string,
    limit: number = 20,
  ): Promise<SchedulerNotification[]> {
    return this.notiRepo.find({
      where: { userId, company, plantCd: plant },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * ?쎌? ?딆? ?뚮┝ 媛쒖닔 議고쉶
   * @param userId ?ъ슜??ID
   * @param company ?뚯궗肄붾뱶
   */
  async getUnreadCount(userId: string, company: string, plant: string): Promise<number> {
    return this.notiRepo.count({
      where: { userId, company, plantCd: plant, isRead: 'N' },
    });
  }

  /**
   * 媛쒕퀎 ?뚮┝ ?쎌쓬 泥섎━
   * @param company ?뚯궗肄붾뱶
   * @param notiId ?뚮┝ ID
   */
  async markAsRead(company: string, plant: string, notiId: number): Promise<void> {
    await this.notiRepo.update(
      { company, plantCd: plant, notiId },
      { isRead: 'Y' },
    );
  }

  /**
   * ?ъ슜?먯쓽 紐⑤뱺 誘몄씫???뚮┝ ?쇨큵 ?쎌쓬 泥섎━
   * @param userId ?ъ슜??ID
   * @param company ?뚯궗肄붾뱶
   */
  async markAllAsRead(userId: string, company: string, plant: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "SCHEDULER_NOTIFICATIONS"
          SET "IS_READ" = 'Y'
        WHERE "COMPANY" = :1 AND "PLANT_CD" = :2 AND "USER_ID" = :3 AND "IS_READ" = 'N'`,
      [company, plant, userId],
    );
    this.logger.log(`?뚮┝ ?쇨큵 ?쎌쓬 泥섎━: company=${company}, plant=${plant}, userId=${userId}`);
  }
}


