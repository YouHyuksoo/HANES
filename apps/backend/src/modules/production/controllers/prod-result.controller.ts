/**
 * @file src/modules/production/controllers/prod-result.controller.ts
 * @description 생산실적 CRUD 및 집계 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/production/prod-results
 * 2. **Swagger**: @ApiTags, @ApiOperation 등으로 문서화
 * 3. **인증**: 필요시 @UseGuards(JwtAuthGuard) 적용
 *
 * API 구조:
 * - GET    /                        : 생산실적 목록 (페이지네이션)
 * - GET    /:id                     : 생산실적 단건 조회
 * - GET    /job-order/:jobOrderId   : 작업지시별 실적 목록
 * - POST   /                        : 생산실적 생성
 * - PUT    /:id                     : 생산실적 수정
 * - DELETE /:id                     : 생산실적 삭제
 * - POST   /:id/complete            : 실적 완료
 * - POST   /:id/cancel              : 실적 취소
 * - GET    /summary/job-order/:id   : 작업지시별 집계
 * - GET    /summary/equip/:id       : 설비별 집계
 * - GET    /summary/worker/:id      : 작업자별 집계
 * - GET    /summary/daily           : 일자별 집계
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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ProdResultService } from '../services/prod-result.service';
import {
  CreateProdResultDto,
  UpdateProdResultDto,
  ProdResultQueryDto,
  CompleteProdResultDto,
} from '../dto/prod-result.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('생산관리 - 생산실적')
@Controller('production/prod-results')
export class ProdResultController {
  constructor(private readonly prodResultService: ProdResultService) {}

  // ===== 기본 CRUD =====

  @Get()
  @ApiOperation({ summary: '생산실적 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ProdResultQueryDto) {
    const result = await this.prodResultService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('job-order/:jobOrderId')
  @ApiOperation({ summary: '작업지시별 생산실적 목록', description: '특정 작업지시의 모든 생산실적 조회' })
  @ApiParam({ name: 'jobOrderId', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findByJobOrderId(@Param('jobOrderId') jobOrderId: string) {
    const data = await this.prodResultService.findByJobOrderId(jobOrderId);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: '생산실적 상세 조회' })
  @ApiParam({ name: 'id', description: '생산실적 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '생산실적 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.prodResultService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '생산실적 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 404, description: '작업지시/설비/작업자 없음' })
  @ApiResponse({ status: 400, description: '완료/취소된 작업지시' })
  async create(@Body() dto: CreateProdResultDto) {
    const data = await this.prodResultService.create(dto);
    return ResponseUtil.success(data, '생산실적이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '생산실적 수정' })
  @ApiParam({ name: 'id', description: '생산실적 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '생산실적 없음' })
  @ApiResponse({ status: 400, description: '수정 불가 상태' })
  async update(@Param('id') id: string, @Body() dto: UpdateProdResultDto) {
    const data = await this.prodResultService.update(id, dto);
    return ResponseUtil.success(data, '생산실적이 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산실적 삭제' })
  @ApiParam({ name: 'id', description: '생산실적 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '생산실적 없음' })
  async delete(@Param('id') id: string) {
    await this.prodResultService.delete(id);
    return ResponseUtil.success(null, '생산실적이 삭제되었습니다.');
  }

  // ===== 상태 변경 =====

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산실적 완료', description: 'RUNNING -> DONE 상태로 변경' })
  @ApiParam({ name: 'id', description: '생산실적 ID' })
  @ApiResponse({ status: 200, description: '완료 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async complete(@Param('id') id: string, @Body() dto: CompleteProdResultDto) {
    const data = await this.prodResultService.complete(id, dto);
    return ResponseUtil.success(data, '생산실적이 완료되었습니다.');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산실적 취소' })
  @ApiParam({ name: 'id', description: '생산실적 ID' })
  @ApiBody({ schema: { type: 'object', properties: { remark: { type: 'string', description: '취소 사유' } } } })
  @ApiResponse({ status: 200, description: '취소 성공' })
  @ApiResponse({ status: 400, description: '이미 취소됨' })
  async cancel(@Param('id') id: string, @Body('remark') remark?: string) {
    const data = await this.prodResultService.cancel(id, remark);
    return ResponseUtil.success(data, '생산실적이 취소되었습니다.');
  }

  // ===== 실적 집계 =====

  @Get('summary/job-order/:jobOrderId')
  @ApiOperation({ summary: '작업지시별 실적 집계', description: '양품/불량 수량, 불량률, 평균 사이클 타임 등' })
  @ApiParam({ name: 'jobOrderId', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummaryByJobOrder(@Param('jobOrderId') jobOrderId: string) {
    const data = await this.prodResultService.getSummaryByJobOrder(jobOrderId);
    return ResponseUtil.success(data);
  }

  @Get('summary/equip/:equipId')
  @ApiOperation({ summary: '설비별 실적 집계', description: '기간 필터링 지원' })
  @ApiParam({ name: 'equipId', description: '설비 ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: '종료일 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummaryByEquip(
    @Param('equipId') equipId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.prodResultService.getSummaryByEquip(equipId, dateFrom, dateTo);
    return ResponseUtil.success(data);
  }

  @Get('summary/worker/:workerId')
  @ApiOperation({ summary: '작업자별 실적 집계', description: '기간 필터링 지원' })
  @ApiParam({ name: 'workerId', description: '작업자 ID' })
  @ApiQuery({ name: 'dateFrom', required: false, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: '종료일 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummaryByWorker(
    @Param('workerId') workerId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const data = await this.prodResultService.getSummaryByWorker(workerId, dateFrom, dateTo);
    return ResponseUtil.success(data);
  }

  @Get('summary/daily')
  @ApiOperation({ summary: '일자별 실적 집계', description: '대시보드용 일별 생산 현황' })
  @ApiQuery({ name: 'dateFrom', required: true, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: true, description: '종료일 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getDailySummary(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const data = await this.prodResultService.getDailySummary(dateFrom, dateTo);
    return ResponseUtil.success(data);
  }
}
