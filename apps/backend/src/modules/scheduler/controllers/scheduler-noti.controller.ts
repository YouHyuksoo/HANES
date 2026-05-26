import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../../common/guards/jwt-auth.guard';
import { SchedulerNotiService } from '../services/scheduler-noti.service';

@ApiTags('Scheduler')
@Controller('scheduler/notifications')
export class SchedulerNotiController {
  constructor(private readonly notiService: SchedulerNotiService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  @ApiResponse({ status: 200, description: 'OK' })
  async findByUser(
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.notiService.findByUser(req.user.id, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count' })
  @ApiResponse({ status: 200, description: 'OK' })
  async getUnreadCount(
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const count = await this.notiService.getUnreadCount(req.user.id, company, plant);
    return ResponseUtil.success({ count });
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'OK' })
  async markAllAsRead(
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.notiService.markAllAsRead(req.user.id, company, plant);
    return ResponseUtil.success(null, 'All notifications marked as read');
  }

  @Patch(':notiId/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'notiId' })
  @ApiResponse({ status: 200, description: 'OK' })
  async markAsRead(
    @Param('notiId', ParseIntPipe) notiId: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.notiService.markAsRead(company, plant, notiId);
    return ResponseUtil.success(null, 'Notification marked as read');
  }
}
