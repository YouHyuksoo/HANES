/**
 * @file modules/system/controllers/system-health.controller.ts
 * @description 시스템 상태 모니터 API (관리자 전용) — /system/health/snapshot
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { SystemHealthService } from '../services/system-health.service';

@ApiTags('시스템관리 - 시스템 상태')
@Controller('system/health')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class SystemHealthController {
  constructor(private readonly service: SystemHealthService) {}

  @Get('snapshot')
  @ApiOperation({ summary: '접속·요청 부하·DB 풀·Oracle 세션·프로세스 자원 스냅샷과 임계값 판정' })
  async snapshot() {
    return ResponseUtil.success(await this.service.getSnapshot());
  }
}
