/**
 * @file modules/system/services/activity-log.service.ts
 * @description 사용자 활동 로그 서비스 - 로그인/페이지 접속 기록 저장 및 조회
 *
 * 초보자 가이드:
 * 1. **logActivity**: SYS_CONFIGS에서 ENABLE_ACTIVITY_LOG 활성화 여부 확인 후 저장
 * 2. **findAll**: 관리 화면용 조회 (페이지네이션 + 필터)
 * 3. SystemModule에 포함되어 AuthModule 등 다른 모듈에서 주입하여 사용
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../../../entities/activity-log.entity';
import { SysConfigService } from './sys-config.service';
import { ActivityLogQueryDto } from '../dto/activity-log.dto';

/** logActivity 메서드에 전달하는 내부 DTO */
export interface LogActivityParams {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  activityType: string;
  pagePath?: string | null;
  pageName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  company?: string | null;
  plant?: string | null;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
    private readonly sysConfigService: SysConfigService,
  ) {}

  /**
   * 활동 로그 기록 - 설정 활성화 시에만 저장
   * 비동기로 실행되며 실패해도 메인 로직에 영향 없음 (fire-and-forget 가능)
   */
  async logActivity(params: LogActivityParams): Promise<void> {
    try {
      const isEnabled = await this.sysConfigService.isEnabled('ENABLE_ACTIVITY_LOG');
      if (!isEnabled) return;

      const log = this.activityLogRepository.create({
        userEmail: params.userId ?? params.userEmail ?? null,
        userName: params.userName ?? null,
        activityType: params.activityType,
        pagePath: params.pagePath ?? null,
        pageName: params.pageName ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        deviceType: params.deviceType ?? null,
        company: params.company ?? null,
        plant: params.plant ?? null,
      });

      await this.activityLogRepository.save(log);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`활동 로그 기록 실패: ${message}`);
    }
  }

  /**
   * 활동 로그 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: ActivityLogQueryDto, company?: string, plant?: string) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.activityLogRepository
      .createQueryBuilder('al')
      .orderBy('al.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (company) qb.andWhere('al.company = :company', { company });
    if (plant) qb.andWhere('al.plant = :plant', { plant });
    if (query.userId) qb.andWhere('al.userEmail = :userId', { userId: query.userId });
    if (query.activityType) qb.andWhere('al.activityType = :activityType', { activityType: query.activityType });

    // 날짜 필터 (TIMESTAMP 컬럼 — Oracle INTERVAL 패턴)
    if (query.fromDate) {
      qb.andWhere("al.createdAt >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere("al.createdAt < TO_DATE(:toDate, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toDate: query.toDate });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }
}
