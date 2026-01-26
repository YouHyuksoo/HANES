/**
 * @file src/modules/quality/controllers/defect-log.controller.ts
 * @description 불량로그 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/quality/defect-logs
 * 2. **Swagger**: @ApiTags, @ApiOperation 등으로 문서화
 * 3. **인증**: 필요시 @UseGuards(JwtAuthGuard) 적용
 *
 * API 구조:
 * - GET  /                       : 불량로그 목록 (페이지네이션)
 * - GET  /pending                : 미처리 불량 목록
 * - GET  /stats/by-type          : 유형별 통계
 * - GET  /stats/by-status        : 상태별 통계
 * - GET  /stats/daily-trend      : 일별 추이
 * - GET  /prod-result/:id        : 생산실적별 불량 목록
 * - GET  /:id                    : 불량로그 단건 조회
 * - GET  /:id/repair-logs        : 수리 이력 조회
 * - POST /                       : 불량로그 생성
 * - POST /:id/repair-logs        : 수리 이력 생성
 * - PUT  /:id                    : 불량로그 수정
 * - PATCH /:id/status            : 불량 상태 변경
 * - DELETE /:id                  : 불량로그 삭제
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { DefectLogService } from '../services/defect-log.service';
import {
  CreateDefectLogDto,
  UpdateDefectLogDto,
  DefectLogQueryDto,
  ChangeDefectStatusDto,
  CreateRepairLogDto,
} from '../dto/defect-log.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('품질관리 - 불량로그')
@Controller('quality/defect-logs')
export class DefectLogController {
  constructor(private readonly defectLogService: DefectLogService) {}

  // ===== 통계 API (목록 조회보다 먼저 정의) =====

  @Get('pending')
  @ApiOperation({ summary: '미처리 불량 목록', description: 'WAIT, REPAIR, REWORK 상태의 불량' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getPendingDefects() {
    const data = await this.defectLogService.getPendingDefects();
    return ResponseUtil.success(data);
  }

  @Get('stats/by-type')
  @ApiOperation({ summary: '불량 유형별 통계', description: '불량 코드별 발생 건수 및 비율' })
  @ApiQuery({ name: 'startDate', required: false, description: '시작 날짜 (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: '종료 날짜 (ISO 8601)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStatsByType(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const data = await this.defectLogService.getStatsByDefectType(startDate, endDate);
    return ResponseUtil.success(data);
  }

  @Get('stats/by-status')
  @ApiOperation({ summary: '불량 상태별 통계', description: '상태별 불량 건수' })
  @ApiQuery({ name: 'startDate', required: false, description: '시작 날짜 (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: '종료 날짜 (ISO 8601)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStatsByStatus(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const data = await this.defectLogService.getStatsByStatus(startDate, endDate);
    return ResponseUtil.success(data);
  }

  @Get('stats/daily-trend')
  @ApiOperation({ summary: '일별 불량 발생 추이', description: '최근 N일간 일별 불량 발생 추이' })
  @ApiQuery({ name: 'days', required: false, description: '조회 일수 (기본 7일)', example: 7 })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getDailyTrend(@Query('days') days?: string) {
    const data = await this.defectLogService.getDailyDefectTrend(
      days ? parseInt(days, 10) : 7
    );
    return ResponseUtil.success(data);
  }

  // ===== 생산실적별 조회 =====

  @Get('prod-result/:prodResultId')
  @ApiOperation({ summary: '생산실적별 불량 목록', description: '특정 생산실적의 불량 목록' })
  @ApiParam({ name: 'prodResultId', description: '생산실적 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findByProdResultId(@Param('prodResultId') prodResultId: string) {
    const data = await this.defectLogService.findByProdResultId(prodResultId);
    return ResponseUtil.success(data);
  }

  // ===== 불량로그 CRUD =====

  @Get()
  @ApiOperation({ summary: '불량로그 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: DefectLogQueryDto) {
    const result = await this.defectLogService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '불량로그 상세 조회' })
  @ApiParam({ name: 'id', description: '불량로그 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '불량로그 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.defectLogService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '불량로그 생성', description: '불량 발생 등록' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 404, description: '생산실적 없음' })
  async create(@Body() dto: CreateDefectLogDto) {
    const data = await this.defectLogService.create(dto);
    return ResponseUtil.success(data, '불량이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '불량로그 수정' })
  @ApiParam({ name: 'id', description: '불량로그 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '불량로그 없음' })
  async update(@Param('id') id: string, @Body() dto: UpdateDefectLogDto) {
    const data = await this.defectLogService.update(id, dto);
    return ResponseUtil.success(data, '불량로그가 수정되었습니다.');
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '불량 상태 변경', description: 'WAIT -> REPAIR -> DONE/SCRAP 등' })
  @ApiParam({ name: 'id', description: '불량로그 ID' })
  @ApiResponse({ status: 200, description: '변경 성공' })
  @ApiResponse({ status: 400, description: '유효하지 않은 상태 변경' })
  @ApiResponse({ status: 404, description: '불량로그 없음' })
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeDefectStatusDto) {
    const data = await this.defectLogService.changeStatus(id, dto);
    return ResponseUtil.success(data, `상태가 ${dto.status}로 변경되었습니다.`);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '불량로그 삭제' })
  @ApiParam({ name: 'id', description: '불량로그 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '불량로그 없음' })
  async delete(@Param('id') id: string) {
    await this.defectLogService.delete(id);
    return ResponseUtil.success(null, '불량로그가 삭제되었습니다.');
  }

  // ===== 수리 이력 =====

  @Get(':id/repair-logs')
  @ApiOperation({ summary: '수리 이력 조회', description: '특정 불량의 수리 이력' })
  @ApiParam({ name: 'id', description: '불량로그 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '불량로그 없음' })
  async getRepairLogs(@Param('id') id: string) {
    const data = await this.defectLogService.getRepairLogs(id);
    return ResponseUtil.success(data);
  }

  @Post(':id/repair-logs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '수리 이력 등록', description: '수리 작업 내역 기록' })
  @ApiParam({ name: 'id', description: '불량로그 ID' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 404, description: '불량로그 없음' })
  async createRepairLog(@Param('id') id: string, @Body() dto: Omit<CreateRepairLogDto, 'defectLogId'>) {
    const data = await this.defectLogService.createRepairLog({
      ...dto,
      defectLogId: id,
    });
    return ResponseUtil.success(data, '수리 이력이 등록되었습니다.');
  }
}
