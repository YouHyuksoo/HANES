/**
 * @file src/modules/interface/controllers/interface.controller.ts
 * @description ERP 인터페이스 API 컨트롤러
 *
 * API 구조:
 * - GET  /interface/logs                        : 인터페이스 로그 목록
 * - GET  /interface/logs/:transDate/:seq        : 인터페이스 로그 상세
 * - POST /interface/logs/:transDate/:seq/retry  : 로그 재시도
 * - POST /interface/logs/bulk-retry             : 일괄 재시도
 * - POST /interface/inbound/job-order           : 작업지시 수신
 * - POST /interface/inbound/bom                 : BOM 동기화
 * - POST /interface/inbound/part                : 품목 동기화
 * - POST /interface/outbound/prod-result        : 생산실적 전송
 * - GET  /interface/summary                     : 현황 요약
 * - GET  /interface/failed                      : 실패 로그 목록
 * - GET  /interface/recent                      : 최근 로그 목록
 */

import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { InterfaceService } from '../services/interface.service';
import {
  InterLogQueryDto,
  BulkRetryDto,
  JobOrderInboundDto,
  BomSyncDto,
  PartSyncDto,
  ProdResultOutboundDto,
} from '../dto/interface.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('인터페이스관리')
@Controller('interface')
export class InterfaceController {
  constructor(private readonly interfaceService: InterfaceService) {}

  // ===== 로그 관리 =====

  @Get('logs')
  @ApiOperation({ summary: '인터페이스 로그 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllLogs(@Query() query: InterLogQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.interfaceService.findAllLogs(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('logs/:transDate/:seq')
  @ApiOperation({ summary: '인터페이스 로그 상세 조회' })
  @ApiParam({ name: 'transDate', description: '전송일 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '일련번호' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findLogById(@Param('transDate') transDate: string, @Param('seq') seq: string) {
    const data = await this.interfaceService.findLogById(new Date(transDate), +seq);
    return ResponseUtil.success(data);
  }

  @Post('logs/:transDate/:seq/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '인터페이스 로그 재시도' })
  @ApiParam({ name: 'transDate', description: '전송일 (YYYY-MM-DD)' })
  @ApiParam({ name: 'seq', description: '일련번호' })
  @ApiResponse({ status: 200, description: '재시도 성공' })
  async retryLog(@Param('transDate') transDate: string, @Param('seq') seq: string) {
    const data = await this.interfaceService.retryLog(new Date(transDate), +seq);
    return ResponseUtil.success(data, '재시도가 완료되었습니다.');
  }

  @Post('logs/bulk-retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '인터페이스 로그 일괄 재시도' })
  @ApiResponse({ status: 200, description: '일괄 재시도 성공' })
  async bulkRetry(@Body() dto: BulkRetryDto) {
    const logKeys = dto.logIds.map((item: any) => ({
      transDate: new Date(item.transDate),
      seq: Number(item.seq),
    }));
    const data = await this.interfaceService.bulkRetry(logKeys);
    return ResponseUtil.success(data, '일괄 재시도가 완료되었습니다.');
  }

  // ===== Inbound (ERP → MES) =====

  @Post('inbound/job-order')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '작업지시 수신 (ERP → MES)' })
  @ApiResponse({ status: 201, description: '수신 성공' })
  async receiveJobOrder(@Body() dto: JobOrderInboundDto) {
    const data = await this.interfaceService.receiveJobOrder(dto);
    return ResponseUtil.success(data, '작업지시가 수신되었습니다.');
  }

  @Post('inbound/bom')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'BOM 동기화 (ERP → MES)' })
  @ApiResponse({ status: 200, description: '동기화 성공' })
  async syncBom(@Body() dtos: BomSyncDto[]) {
    const data = await this.interfaceService.syncBom(dtos);
    return ResponseUtil.success(data, 'BOM 동기화가 완료되었습니다.');
  }

  @Post('inbound/part')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '품목 마스터 동기화 (ERP → MES)' })
  @ApiResponse({ status: 200, description: '동기화 성공' })
  async syncPart(@Body() dtos: PartSyncDto[]) {
    const data = await this.interfaceService.syncPart(dtos);
    return ResponseUtil.success(data, '품목 동기화가 완료되었습니다.');
  }

  // ===== Outbound (MES → ERP) =====

  @Post('outbound/prod-result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산실적 전송 (MES → ERP)' })
  @ApiResponse({ status: 200, description: '전송 성공' })
  async sendProdResult(@Body() dto: ProdResultOutboundDto) {
    const data = await this.interfaceService.sendProdResult(dto);
    return ResponseUtil.success(data, '생산실적이 전송되었습니다.');
  }

  // ===== 통계 및 모니터링 =====

  @Get('summary')
  @ApiOperation({ summary: '인터페이스 현황 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummary() {
    const data = await this.interfaceService.getSummary();
    return ResponseUtil.success(data);
  }

  @Get('failed')
  @ApiOperation({ summary: '실패 로그 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getFailedLogs() {
    const data = await this.interfaceService.getFailedLogs();
    return ResponseUtil.success(data);
  }

  @Get('recent')
  @ApiOperation({ summary: '최근 로그 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getRecentLogs(@Query('limit') limit?: number) {
    const data = await this.interfaceService.getRecentLogs(limit);
    return ResponseUtil.success(data);
  }
}
