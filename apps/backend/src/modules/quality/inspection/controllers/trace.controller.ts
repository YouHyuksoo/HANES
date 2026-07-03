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
 * - ProductTraceabilityService: 제품+반제품+자재 PO/IQC 종합 추적
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
import { ProductTraceabilityService } from '../services/product-traceability.service';
import { TraceSearchMode } from '../dto/product-traceability.dto';
import { ResponseUtil } from '../../../../common/dto/response.dto';

@ApiTags('품질관리 - 추적성 조회')
@Controller('quality/trace')
export class TraceController {
  constructor(private readonly traceabilityService: ProductTraceabilityService) {}

  @Get('candidates')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '추적 시작 후보 조회',
    description: '제품/자재/박스/팔레트/출하지시/설비/작업지시/SG 기준으로 추적 대상 후보를 조회',
  })
  async getCandidates(
    @Query('mode') mode: TraceSearchMode,
    @Query('value') value: string | undefined,
    @Query('equipCode') equipCode: string | undefined,
    @Query('dateFrom') dateFrom: string | undefined,
    @Query('dateTo') dateTo: string | undefined,
    @Query('confirmLarge') confirmLarge: string | undefined,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.traceabilityService.findCandidates(
      mode,
      { value, equipCode, dateFrom, dateTo, confirmLarge: confirmLarge === 'true' },
      company,
      plant,
    );
    return ResponseUtil.success(data);
  }

  /**
   * 시리얼번호로 추적성 데이터 조회
   * @param serial - 시리얼번호 (FG_BARCODE)
   * @param company - 회사코드 (JWT에서 자동 추출)
   * @param plant - 공장코드 (JWT에서 자동 추출)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
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
    const data = await this.traceabilityService.getBySerial(serial, company, plant);
    return ResponseUtil.success(data);
  }
}
