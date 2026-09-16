/**
 * @file src/modules/equipment/controllers/equip-stop.controller.ts
 * @description 설비정지 / 관리자호출 API
 *
 * 설비정지 (/equipment/stop)
 * - GET    /open?equipCode=   진행중 정지 복원(키오스크 재진입/새로고침용)
 * - GET    /?equipCode&from&to  정지 이력 + 유실시간 집계
 * - POST   /                  정지 시작 (이미 정지중이면 409)
 * - PATCH  /:stopId/reason    정지사유 확정/변경
 * - POST   /:stopId/release   해제 (사유 미확정이면 400)
 *
 * 관리자호출 (/equipment/call)
 * - GET    /open?equipCode=   진행중 호출
 * - GET    /?equipCode&from&to  호출 이력
 * - POST   /                  호출 등록
 * - POST   /:callId/ack       응대 처리
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { EquipStopService } from '../services/equip-stop.service';
import {
  StartEquipStopDto,
  UpdateEquipStopReasonDto,
  ReleaseEquipStopDto,
  CreateEquipCallDto,
  AckEquipCallDto,
} from '../dto/equip-stop.dto';

@ApiTags('설비정지')
@Controller('equipment/stop')
export class EquipStopController {
  constructor(private readonly service: EquipStopService) {}

  @Get('open')
  @ApiOperation({ summary: '진행중 설비정지 조회' })
  async findOpen(
    @Query('equipCode') equipCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.findOpenStop(equipCode, company, plant);
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: '설비정지 이력 + 유실시간 집계' })
  async list(
    @Company() company: string,
    @Plant() plant: string,
    @Query('equipCode') equipCode?: string,
    @Query('jobOrderNo') jobOrderNo?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const result = await this.service.findStops(
      { equipCode, jobOrderNo, from, to },
      company,
      plant,
    );
    return { success: true, data: result.data, summary: result.summary };
  }

  @Post()
  @ApiOperation({ summary: '설비정지 시작' })
  async start(
    @Body() dto: StartEquipStopDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.startStop(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return { success: true, data };
  }

  @Patch(':stopId/reason')
  @ApiOperation({ summary: '정지사유 확정/변경' })
  async updateReason(
    @Param('stopId', ParseIntPipe) stopId: number,
    @Body() dto: UpdateEquipStopReasonDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.updateReason(
      stopId,
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return { success: true, data };
  }

  @Post(':stopId/release')
  @ApiOperation({ summary: '설비정지 해제' })
  async release(
    @Param('stopId', ParseIntPipe) stopId: number,
    @Body() dto: ReleaseEquipStopDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.releaseStop(
      stopId,
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return { success: true, data };
  }
}

@ApiTags('설비정지')
@Controller('equipment/call')
export class EquipCallController {
  constructor(private readonly service: EquipStopService) {}

  @Get('open')
  @ApiOperation({ summary: '진행중 관리자호출 조회' })
  async findOpen(
    @Query('equipCode') equipCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.findOpenCall(equipCode, company, plant);
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: '관리자호출 이력' })
  async list(
    @Company() company: string,
    @Plant() plant: string,
    @Query('equipCode') equipCode?: string,
    @Query('onlyOpen') onlyOpen?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.service.findCalls(
      { equipCode, from, to, onlyOpen: onlyOpen === 'Y' },
      company,
      plant,
    );
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: '관리자호출 등록' })
  async create(
    @Body() dto: CreateEquipCallDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.createCall(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return { success: true, data };
  }

  @Post(':callId/ack')
  @ApiOperation({ summary: '관리자호출 응대' })
  async ack(
    @Param('callId', ParseIntPipe) callId: number,
    @Body() dto: AckEquipCallDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.ackCall(
      callId,
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return { success: true, data };
  }
}
