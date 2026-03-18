/**
 * @file msa.controller.ts
 * @description MSA(측정시스템분석) API 컨트롤러 — IATF 16949 7.1.5
 *
 * 초보자 가이드:
 * 1. **계측기 API**: /api/v1/quality/msa/gauges
 *    - GET    /gauges              : 목록 조회 (페이지네이션)
 *    - GET    /gauges/expiring-soon: 교정 만료 예정 조회
 *    - GET    /gauges/:id          : 단건 조회
 *    - POST   /gauges              : 등록
 *    - PUT    /gauges/:id          : 수정
 *    - DELETE /gauges/:id          : 삭제
 *
 * 2. **교정 이력 API**: /api/v1/quality/msa/calibrations
 *    - GET    /calibrations        : 목록 조회 (페이지네이션)
 *    - POST   /calibrations        : 등록 (자동채번)
 *    - DELETE /calibrations/:id    : 삭제
 *
 * 3. **상태 관리 API**:
 *    - PATCH  /gauges/update-statuses : 교정 만료 상태 일괄 갱신
 *
 * 4. **인증**: @Company(), @Plant() 데코레이터로 테넌시 정보, req.user.id로 사용자 ID 추출
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { MsaService } from '../services/msa.service';
import {
  CreateGaugeDto,
  UpdateGaugeDto,
  GaugeFilterDto,
  CreateCalibrationDto,
  CalibrationFilterDto,
} from '../dto/msa.dto';

@ApiTags('품질관리 - MSA')
@Controller('quality/msa')
export class MsaController {
  constructor(private readonly msaService: MsaService) {}

  // ===== 계측기 마스터 API =====

  @Get('gauges/expiring-soon')
  @ApiOperation({
    summary: '교정 만료 예정 계측기 조회',
    description: 'N일 이내 교정 만료 예정인 계측기 목록',
  })
  @ApiQuery({ name: 'days', required: false, description: '조회 일수 (기본 30)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getExpiringSoon(
    @Query('days') days: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const d = days ? parseInt(days, 10) : 30;
    const data = await this.msaService.getExpiringSoon(d, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('gauges')
  @ApiOperation({ summary: '계측기 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllGauges(
    @Query() query: GaugeFilterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.msaService.findAllGauges(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('gauges/:id')
  @ApiOperation({ summary: '계측기 단건 조회' })
  @ApiParam({ name: 'id', description: '계측기 코드' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '계측기 없음' })
  async findGaugeById(@Param('id') id: string) {
    const data = await this.msaService.findGaugeById(id);
    return ResponseUtil.success(data);
  }

  @Post('gauges')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '계측기 등록' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async createGauge(
    @Body() dto: CreateGaugeDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.msaService.createGauge(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '계측기가 등록되었습니다.');
  }

  @Put('gauges/:id')
  @ApiOperation({ summary: '계측기 수정' })
  @ApiParam({ name: 'id', description: '계측기 코드' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateGauge(
    @Param('id') id: string,
    @Body() dto: UpdateGaugeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.msaService.updateGauge(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '계측기가 수정되었습니다.');
  }

  @Delete('gauges/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '계측기 삭제', description: '교정 이력 없는 경우만 삭제 가능' })
  @ApiParam({ name: 'id', description: '계측기 코드' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteGauge(@Param('id') id: string) {
    await this.msaService.deleteGauge(id);
    return ResponseUtil.success(null, '계측기가 삭제되었습니다.');
  }

  @Patch('gauges/update-statuses')
  @ApiOperation({
    summary: '교정 만료 상태 일괄 갱신',
    description: '교정 만료된 ACTIVE 계측기를 EXPIRED로 변경',
  })
  @ApiResponse({ status: 200, description: '갱신 완료' })
  async updateStatuses(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.msaService.updateCalibrationStatus(company, plant);
    return ResponseUtil.success(data, '교정 상태가 갱신되었습니다.');
  }

  // ===== 교정 이력 API =====

  @Get('calibrations')
  @ApiOperation({ summary: '교정 이력 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllCalibrations(
    @Query() query: CalibrationFilterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.msaService.findAllCalibrations(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post('calibrations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '교정 이력 등록', description: '자동채번 CAL-YYYYMMDD-NNN' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async createCalibration(
    @Body() dto: CreateCalibrationDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.msaService.createCalibration(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '교정 이력이 등록되었습니다.');
  }

  @Delete('calibrations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '교정 이력 삭제' })
  @ApiParam({ name: 'id', description: '교정번호 (calibrationNo)' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteCalibration(@Param('id') id: string) {
    await this.msaService.deleteCalibration(id);
    return ResponseUtil.success(null, '교정 이력이 삭제되었습니다.');
  }
}
