/**
 * @file controllers/sensor-monitor.controller.ts
 * @description 센서 모니터링 API — 센서 데이터 수신 및 조건 규칙 관리
 *
 * 초보자 가이드:
 * 1. POST /equipment/sensor-data        — 센서 데이터 일괄 수신
 * 2. GET  /equipment/sensor-data        — 센서 데이터 이력 조회
 * 3. GET  /equipment/condition-rules    — 조건 규칙 목록
 * 4. POST /equipment/condition-rules    — 조건 규칙 생성
 * 5. PUT  /equipment/condition-rules/:id — 조건 규칙 수정
 * 6. DELETE /equipment/condition-rules/:id — 조건 규칙 삭제
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { SensorMonitorService } from '../services/sensor-monitor.service';
import {
  PostSensorDataDto,
  SensorDataQueryDto,
  CreateConditionRuleDto,
  UpdateConditionRuleDto,
  ConditionRuleQueryDto,
} from '../dto/sensor-monitor.dto';

@ApiTags('설비관리 - 센서 모니터링')
@UseGuards(JwtAuthGuard)
@Controller('equipment')
export class SensorMonitorController {
  constructor(private readonly sensorMonitorService: SensorMonitorService) {}

  // ─── 센서 데이터 ────────────────────────────────────────

  @Post('sensor-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '센서 데이터 일괄 수신' })
  @ApiResponse({ status: 200, description: '수신 완료 + 규칙 평가 결과' })
  async receiveSensorData(
    @Body() dto: PostSensorDataDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.sensorMonitorService.receiveSensorData(dto, company, plant);
    return ResponseUtil.success(data, `센서 데이터 ${data.saved}건 수신 완료`);
  }

  @Get('sensor-data')
  @ApiOperation({ summary: '센서 데이터 이력 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async querySensorData(@Query() query: SensorDataQueryDto) {
    const result = await this.sensorMonitorService.querySensorData(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  // ─── 조건 규칙 ────────────────────────────────────────

  @Get('condition-rules')
  @ApiOperation({ summary: '조건 감시 규칙 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllRules(@Query() query: ConditionRuleQueryDto) {
    const result = await this.sensorMonitorService.findAllRules(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post('condition-rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '조건 감시 규칙 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async createRule(
    @Body() dto: CreateConditionRuleDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.sensorMonitorService.createRule(dto, company, plant);
    return ResponseUtil.success(data, '조건 규칙이 등록되었습니다.');
  }

  @Put('condition-rules/:id')
  @ApiOperation({ summary: '조건 감시 규칙 수정' })
  @ApiParam({ name: 'id', description: '규칙 ID' })
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateConditionRuleDto,
  ) {
    const data = await this.sensorMonitorService.updateRule(Number(id), dto);
    return ResponseUtil.success(data, '조건 규칙이 수정되었습니다.');
  }

  @Delete('condition-rules/:id')
  @ApiOperation({ summary: '조건 감시 규칙 삭제' })
  @ApiParam({ name: 'id', description: '규칙 ID' })
  async deleteRule(@Param('id') id: string) {
    await this.sensorMonitorService.deleteRule(Number(id));
    return ResponseUtil.success(null, '조건 규칙이 삭제되었습니다.');
  }
}
