/**
 * @file src/modules/scheduler/controllers/scheduler-noti.controller.ts
 * @description 스케줄러 알림 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /scheduler/notifications**: 현재 사용자의 최근 알림 목록
 * 2. **GET /scheduler/notifications/unread-count**: 읽지 않은 알림 개수 (헤더 벨 뱃지)
 * 3. **PATCH /scheduler/notifications/:notiId/read**: 개별 알림 읽음 처리
 * 4. **PATCH /scheduler/notifications/read-all**: 전체 알림 일괄 읽음 처리
 */

import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard, AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { SchedulerNotiService } from '../services/scheduler-noti.service';

@ApiTags('Scheduler')
@Controller('scheduler/notifications')
@UseGuards(JwtAuthGuard)
export class SchedulerNotiController {
  constructor(private readonly notiService: SchedulerNotiService) {}

  @Get()
  @ApiOperation({ summary: '내 알림 목록 조회', description: '최근 20건의 알림을 조회합니다.' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findByUser(
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
  ) {
    const data = await this.notiService.findByUser(req.user.id, company);
    return ResponseUtil.success(data);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '읽지 않은 알림 개수', description: '헤더 알림 벨 뱃지용' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getUnreadCount(
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
  ) {
    const count = await this.notiService.getUnreadCount(req.user.id, company);
    return ResponseUtil.success({ count });
  }

  @Patch('read-all')
  @ApiOperation({ summary: '전체 알림 일괄 읽음 처리' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async markAllAsRead(
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
  ) {
    await this.notiService.markAllAsRead(req.user.id, company);
    return ResponseUtil.success(null, '모든 알림이 읽음 처리되었습니다.');
  }

  @Patch(':notiId/read')
  @ApiOperation({ summary: '개별 알림 읽음 처리' })
  @ApiParam({ name: 'notiId', description: '알림 ID' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async markAsRead(
    @Param('notiId', ParseIntPipe) notiId: number,
    @Company() company: string,
  ) {
    await this.notiService.markAsRead(company, notiId);
    return ResponseUtil.success(null, '알림이 읽음 처리되었습니다.');
  }
}
