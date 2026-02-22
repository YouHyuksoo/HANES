/**
 * @file src/modules/quality/controllers/inspect-result.controller.ts
 * @description 검사실적 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/quality/inspect-results
 * 2. **Swagger**: @ApiTags, @ApiOperation 등으로 문서화
 * 3. **인증**: 필요시 @UseGuards(JwtAuthGuard) 적용
 *
 * API 구조:
 * - GET  /                    : 검사실적 목록 (페이지네이션)
 * - GET  /stats/pass-rate     : 합격률 통계
 * - GET  /stats/by-type       : 유형별 통계
 * - GET  /stats/daily-trend   : 일별 추이
 * - GET  /serial/:serialNo    : 시리얼 번호별 검사 이력
 * - GET  /:id                 : 검사실적 단건 조회
 * - POST /                    : 검사실적 생성
 * - POST /batch               : 검사실적 일괄 생성
 * - PUT  /:id                 : 검사실적 수정
 * - DELETE /:id               : 검사실적 삭제
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
} from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InspectResultService } from '../services/inspect-result.service';
import {
  CreateInspectResultDto,
  UpdateInspectResultDto,
  InspectResultQueryDto,
} from '../dto/inspect-result.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('품질관리 - 검사실적')
@Controller('quality/inspect-results')
export class InspectResultController {
  constructor(private readonly inspectResultService: InspectResultService) {}

  // ===== 통계 API (목록 조회보다 먼저 정의) =====

  @Get('stats/pass-rate')
  @ApiOperation({ summary: '합격률 통계 조회', description: '기간 및 검사유형별 합격률 통계' })
  @ApiQuery({ name: 'startDate', required: false, description: '시작 날짜 (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: '종료 날짜 (ISO 8601)' })
  @ApiQuery({ name: 'inspectType', required: false, description: '검사 유형' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getPassRate(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('inspectType') inspectType?: string
  ) {
    const data = await this.inspectResultService.getPassRate(startDate, endDate, inspectType);
    return ResponseUtil.success(data);
  }

  @Get('stats/by-type')
  @ApiOperation({ summary: '검사 유형별 통계', description: '검사 유형별 합격률 통계' })
  @ApiQuery({ name: 'startDate', required: false, description: '시작 날짜 (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: '종료 날짜 (ISO 8601)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStatsByType(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const data = await this.inspectResultService.getStatsByType(startDate, endDate);
    return ResponseUtil.success(data);
  }

  @Get('stats/daily-trend')
  @ApiOperation({ summary: '일별 합격률 추이', description: '최근 N일간 일별 합격률 추이' })
  @ApiQuery({ name: 'days', required: false, description: '조회 일수 (기본 7일)', example: 7 })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getDailyTrend(@Query('days') days?: string) {
    const data = await this.inspectResultService.getDailyPassRateTrend(
      days ? parseInt(days, 10) : 7
    );
    return ResponseUtil.success(data);
  }

  // ===== 시리얼 조회 =====

  @Get('serial/:serialNo')
  @ApiOperation({ summary: '시리얼 번호별 검사 이력', description: '특정 시리얼의 전체 검사 이력' })
  @ApiParam({ name: 'serialNo', description: '시리얼 번호' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findBySerialNo(@Param('serialNo') serialNo: string) {
    const data = await this.inspectResultService.findBySerialNo(serialNo);
    return ResponseUtil.success(data);
  }

  @Get('prod-result/:prodResultId')
  @ApiOperation({ summary: '생산실적별 검사 이력', description: '특정 생산실적의 전체 검사 이력' })
  @ApiParam({ name: 'prodResultId', description: '생산실적 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findByProdResultId(@Param('prodResultId') prodResultId: string) {
    const data = await this.inspectResultService.findByProdResultId(prodResultId);
    return ResponseUtil.success(data);
  }

  // ===== 검사실적 CRUD =====

  @Get()
  @ApiOperation({ summary: '검사실적 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: InspectResultQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.inspectResultService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '검사실적 상세 조회' })
  @ApiParam({ name: 'id', description: '검사실적 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '검사실적 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.inspectResultService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '검사실적 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 404, description: '생산실적 없음' })
  async create(@Body() dto: CreateInspectResultDto) {
    const data = await this.inspectResultService.create(dto);
    return ResponseUtil.success(data, '검사실적이 등록되었습니다.');
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '검사실적 일괄 생성', description: '여러 검사 결과를 한번에 등록' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async createMany(@Body() dtos: CreateInspectResultDto[]) {
    const data = await this.inspectResultService.createMany(dtos);
    return ResponseUtil.success(data, `${data.count}건의 검사실적이 등록되었습니다.`);
  }

  @Put(':id')
  @ApiOperation({ summary: '검사실적 수정' })
  @ApiParam({ name: 'id', description: '검사실적 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '검사실적 없음' })
  async update(@Param('id') id: string, @Body() dto: UpdateInspectResultDto) {
    const data = await this.inspectResultService.update(id, dto);
    return ResponseUtil.success(data, '검사실적이 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '검사실적 삭제' })
  @ApiParam({ name: 'id', description: '검사실적 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '검사실적 없음' })
  async delete(@Param('id') id: string) {
    await this.inspectResultService.delete(id);
    return ResponseUtil.success(null, '검사실적이 삭제되었습니다.');
  }
}
