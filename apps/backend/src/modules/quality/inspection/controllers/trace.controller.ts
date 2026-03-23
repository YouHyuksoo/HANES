/**
 * @file src/modules/quality/inspection/controllers/trace.controller.ts
 * @description 추적성 조회 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: GET /api/v1/quality/trace?serial={serialNo}
 * 2. 시리얼번호(FG_BARCODE)로 4M(Man, Machine, Material, Method) 이력 조회
 * 3. 결과가 없으면 data: null 반환 (404 아님)
 *
 * @dependencies
 * - TraceService: 추적성 데이터 종합 조회
 * - JwtAuthGuard: JWT 인증
 * - Company, Plant: 멀티테넌시 데코레이터
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { TraceService } from '../services/trace.service';
import { ResponseUtil } from '../../../../common/dto/response.dto';

@ApiTags('품질관리 - 추적성 조회')
@UseGuards(JwtAuthGuard)
@Controller('quality/trace')
export class TraceController {
  constructor(private readonly traceService: TraceService) {}

  /**
   * 시리얼번호로 추적성 데이터 조회
   * @param serial - 시리얼번호 (FG_BARCODE)
   * @param company - 회사코드 (JWT에서 자동 추출)
   * @param plant - 공장코드 (JWT에서 자동 추출)
   */
  @Get()
  @ApiOperation({
    summary: '추적성 조회',
    description: '시리얼번호(FG바코드)로 4M 이력 및 공정 타임라인 종합 조회',
  })
  @ApiQuery({ name: 'serial', required: true, description: '시리얼번호 (FG_BARCODE)' })
  @ApiResponse({ status: 200, description: '조회 성공 (데이터 없으면 data: null)' })
  async getTrace(
    @Query('serial') serial: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.traceService.findBySerial(serial, company, plant);
    return ResponseUtil.success(data);
  }
}
