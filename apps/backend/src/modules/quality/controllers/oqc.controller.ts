/**
 * @file src/modules/quality/controllers/oqc.controller.ts
 * @description OQC(출하검사) API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /quality/oqc**: 의뢰 목록 (필터+페이지네이션)
 * 2. **POST /quality/oqc**: 의뢰 생성 (박스 연결)
 * 3. **POST /quality/oqc/:id/execute**: 검사 실행 (PASS/FAIL)
 * 4. **PATCH /quality/oqc/:id/result**: 결과 수정
 *
 * API 구조:
 * GET    /quality/oqc/stats           → 통계
 * GET    /quality/oqc/available-boxes → 검사 가능 박스
 * GET    /quality/oqc                 → 목록
 * GET    /quality/oqc/:id             → 상세
 * POST   /quality/oqc                 → 의뢰 생성
 * POST   /quality/oqc/:id/execute     → 검사 실행
 * PATCH  /quality/oqc/:id/result      → 결과 수정
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OqcService } from '../services/oqc.service';
import {
  CreateOqcRequestDto,
  ExecuteOqcInspectionDto,
  UpdateOqcResultDto,
  OqcRequestQueryDto,
} from '../dto/oqc.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('품질관리 - OQC(출하검사)')
@Controller('quality/oqc')
export class OqcController {
  constructor(private readonly oqcService: OqcService) {}

  // ===== 통계/유틸 API (목록 조회보다 먼저 정의) =====

  @Get('stats')
  @ApiOperation({ summary: 'OQC 통계', description: '총/대기/합격/불합격 건수' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStats(@Req() req: Request) {
    const company = req.headers['x-company'] as string | undefined;
    const data = await this.oqcService.getStats(company);
    return ResponseUtil.success(data);
  }

  @Get('available-boxes')
  @ApiOperation({ summary: '검사 가능 박스 목록', description: 'CLOSED + OQC 미의뢰 박스' })
  @ApiQuery({ name: 'itemCode', required: false, description: '품목 ID로 필터링' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getAvailableBoxes(
    @Query('itemCode') itemCode?: string,
    @Req() req?: Request,
  ) {
    const company = req?.headers['x-company'] as string | undefined;
    const data = await this.oqcService.getAvailableBoxes(itemCode, company);
    return ResponseUtil.success(data);
  }

  // ===== CRUD =====

  @Get()
  @ApiOperation({ summary: 'OQC 의뢰 목록 조회', description: '필터링/페이지네이션' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: OqcRequestQueryDto, @Req() req: Request) {
    const company = req.headers['x-company'] as string | undefined;
    const result = await this.oqcService.findAll(query, company);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'OQC 의뢰 상세 조회' })
  @ApiParam({ name: 'id', description: 'OQC 의뢰 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '의뢰 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.oqcService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'OQC 의뢰 생성', description: '박스 선택 후 검사 의뢰' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 400, description: '유효하지 않은 박스' })
  async createRequest(@Body() dto: CreateOqcRequestDto, @Req() req: Request) {
    const company = req.headers['x-company'] as string | undefined;
    const userId = (req as any).user?.userId;
    const data = await this.oqcService.createRequest(dto, company, userId);
    return ResponseUtil.success(data, 'OQC 의뢰가 생성되었습니다.');
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OQC 검사 실행', description: '판정(PASS/FAIL) 처리' })
  @ApiParam({ name: 'id', description: 'OQC 의뢰 ID' })
  @ApiResponse({ status: 200, description: '검사 실행 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 404, description: '의뢰 없음' })
  async executeInspection(
    @Param('id') id: string,
    @Body() dto: ExecuteOqcInspectionDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.oqcService.executeInspection(id, dto, userId);
    return ResponseUtil.success(data, `검사 결과: ${dto.result}`);
  }

  @Patch(':id/result')
  @ApiOperation({ summary: 'OQC 결과 수정', description: '판정 후 결과 보정' })
  @ApiParam({ name: 'id', description: 'OQC 의뢰 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '의뢰 없음' })
  async updateResult(
    @Param('id') id: string,
    @Body() dto: UpdateOqcResultDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.userId;
    const data = await this.oqcService.updateResult(id, dto, userId);
    return ResponseUtil.success(data, '결과가 수정되었습니다.');
  }
}
