/**
 * @file src/modules/production/controllers/job-order.controller.ts
 * @description 작업지시 CRUD 및 상태 관리 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/production/job-orders
 * 2. **Swagger**: @ApiTags, @ApiOperation 등으로 문서화
 * 3. **인증**: 필요시 @UseGuards(JwtAuthGuard) 적용
 *
 * API 구조:
 * - GET    /                    : 작업지시 목록 (페이지네이션)
 * - GET    /:id                 : 작업지시 단건 조회
 * - GET    /order-no/:orderNo   : 작업지시번호로 조회
 * - POST   /                    : 작업지시 생성
 * - PUT    /:id                 : 작업지시 수정
 * - DELETE /:id                 : 작업지시 삭제
 * - POST   /:id/start           : 작업 시작
 * - POST   /:id/pause           : 작업 일시정지
 * - POST   /:id/complete        : 작업 완료
 * - POST   /:id/cancel          : 작업 취소
 * - PUT    /:id/erp-sync        : ERP 동기화 플래그 변경
 * - GET    /erp/unsynced        : ERP 미동기화 목록
 * - GET    /:id/summary         : 실적 집계
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
  ApiBody,
} from '@nestjs/swagger';
import { JobOrderService } from '../services/job-order.service';
import {
  CreateJobOrderDto,
  UpdateJobOrderDto,
  JobOrderQueryDto,
  ChangeJobOrderStatusDto,
  UpdateErpSyncDto,
} from '../dto/job-order.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('생산관리 - 작업지시')
@Controller('production/job-orders')
export class JobOrderController {
  constructor(private readonly jobOrderService: JobOrderService) {}

  // ===== 기본 CRUD =====

  @Get()
  @ApiOperation({ summary: '작업지시 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: JobOrderQueryDto) {
    const result = await this.jobOrderService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('erp/unsynced')
  @ApiOperation({ summary: 'ERP 미동기화 작업지시 목록', description: '완료된 작업지시 중 ERP에 동기화되지 않은 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findUnsyncedForErp() {
    const data = await this.jobOrderService.findUnsyncedForErp();
    return ResponseUtil.success(data);
  }

  @Get('order-no/:orderNo')
  @ApiOperation({ summary: '작업지시번호로 조회' })
  @ApiParam({ name: 'orderNo', description: '작업지시 번호', example: 'JO-20250126-001' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '작업지시 없음' })
  async findByOrderNo(@Param('orderNo') orderNo: string) {
    const data = await this.jobOrderService.findByOrderNo(orderNo);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: '작업지시 상세 조회' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '작업지시 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.jobOrderService.findById(id);
    return ResponseUtil.success(data);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: '작업지시 실적 집계', description: '해당 작업지시의 생산실적 요약 정보' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '작업지시 없음' })
  async getJobOrderSummary(@Param('id') id: string) {
    const data = await this.jobOrderService.getJobOrderSummary(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '작업지시 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 409, description: '중복 작업지시번호' })
  async create(@Body() dto: CreateJobOrderDto) {
    const data = await this.jobOrderService.create(dto);
    return ResponseUtil.success(data, '작업지시가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '작업지시 수정' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '작업지시 없음' })
  @ApiResponse({ status: 400, description: '수정 불가 상태' })
  async update(@Param('id') id: string, @Body() dto: UpdateJobOrderDto) {
    const data = await this.jobOrderService.update(id, dto);
    return ResponseUtil.success(data, '작업지시가 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '작업지시 삭제' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '작업지시 없음' })
  @ApiResponse({ status: 400, description: '삭제 불가 상태' })
  async delete(@Param('id') id: string) {
    await this.jobOrderService.delete(id);
    return ResponseUtil.success(null, '작업지시가 삭제되었습니다.');
  }

  // ===== 상태 변경 =====

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '작업 시작', description: 'WAITING/PAUSED -> RUNNING 상태로 변경' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '시작 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async start(@Param('id') id: string) {
    const data = await this.jobOrderService.start(id);
    return ResponseUtil.success(data, '작업이 시작되었습니다.');
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '작업 일시정지', description: 'RUNNING -> PAUSED 상태로 변경' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '일시정지 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async pause(@Param('id') id: string) {
    const data = await this.jobOrderService.pause(id);
    return ResponseUtil.success(data, '작업이 일시정지되었습니다.');
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '작업 완료', description: 'RUNNING/PAUSED -> DONE 상태로 변경, 실적 자동 집계' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '완료 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async complete(@Param('id') id: string) {
    const data = await this.jobOrderService.complete(id);
    return ResponseUtil.success(data, '작업이 완료되었습니다.');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '작업 취소', description: 'WAITING/PAUSED -> CANCELED 상태로 변경' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiBody({ schema: { type: 'object', properties: { remark: { type: 'string', description: '취소 사유' } } } })
  @ApiResponse({ status: 200, description: '취소 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async cancel(@Param('id') id: string, @Body('remark') remark?: string) {
    const data = await this.jobOrderService.cancel(id, remark);
    return ResponseUtil.success(data, '작업이 취소되었습니다.');
  }

  @Put(':id/status')
  @ApiOperation({ summary: '상태 직접 변경 (관리자용)', description: '상태를 직접 변경 (주의: 워크플로우 무시)' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '변경 성공' })
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeJobOrderStatusDto) {
    const data = await this.jobOrderService.changeStatus(id, dto);
    return ResponseUtil.success(data, '상태가 변경되었습니다.');
  }

  // ===== ERP 연동 =====

  @Put(':id/erp-sync')
  @ApiOperation({ summary: 'ERP 동기화 플래그 변경' })
  @ApiParam({ name: 'id', description: '작업지시 ID' })
  @ApiResponse({ status: 200, description: '변경 성공' })
  async updateErpSyncYn(@Param('id') id: string, @Body() dto: UpdateErpSyncDto) {
    const data = await this.jobOrderService.updateErpSyncYn(id, dto);
    return ResponseUtil.success(data, 'ERP 동기화 상태가 변경되었습니다.');
  }

  @Post('erp/mark-synced')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ERP 동기화 완료 처리 (일괄)', description: '여러 작업지시를 동기화 완료 처리' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async markAsSynced(@Body('ids') ids: string[]) {
    const result = await this.jobOrderService.markAsSynced(ids);
    return ResponseUtil.success(result, `${result.count}건의 작업지시가 동기화 완료 처리되었습니다.`);
  }
}
