/**
 * @file modules/system/controllers/activity-log.controller.ts
 * @description 활동 로그 API 컨트롤러 - 프론트엔드 로그 전송 및 관리 화면 조회
 *
 * 초보자 가이드:
 * 1. POST /system/activity-logs: 프론트엔드에서 페이지 접속 기록 전송
 * 2. GET /system/activity-logs: 관리 화면에서 활동 로그 조회 (페이지네이션)
 * 3. Bearer 토큰에서 userId만 추출 (DB 재검증 없음 — 이미 로그인된 사용자)
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { ActivityLogService } from '../services/activity-log.service';
import { CreateActivityLogDto, ActivityLogQueryDto } from '../dto/activity-log.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('시스템관리 - 활동 로그')
@Controller('system/activity-logs')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '활동 로그 기록 (페이지 접속)' })
  async create(@Body() dto: CreateActivityLogDto, @Req() req: Request) {
    const userId = this.extractUserId(req);
    if (!userId) {
      return ResponseUtil.success(null);
    }

    const userAgent = req.headers['user-agent'] || null;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const company = (req.headers['x-company'] as string) || null;
    const plant = (req.headers['x-plant'] as string) || null;

    await this.activityLogService.logActivity({
      userId,
      activityType: dto.activityType,
      pagePath: dto.pagePath ?? null,
      pageName: dto.pageName ?? null,
      ipAddress,
      userAgent,
      deviceType: dto.deviceType ?? 'PC',
      company,
      plant,
    });

    return ResponseUtil.success(null);
  }

  @Get()
  @ApiOperation({ summary: '활동 로그 조회 (페이지네이션)' })
  async findAll(@Query() query: ActivityLogQueryDto, @Req() req: Request) {
    const company = (req.headers['x-company'] as string) || undefined;
    const plant = (req.headers['x-plant'] as string) || undefined;
    const result = await this.activityLogService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  /** Authorization: Bearer {userId} 에서 userId 추출 */
  private extractUserId(req: Request): string | null {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const [type, token] = auth.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
