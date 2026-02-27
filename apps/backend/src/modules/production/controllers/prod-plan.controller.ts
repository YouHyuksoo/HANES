/**
 * @file src/modules/production/controllers/prod-plan.controller.ts
 * @description 월간생산계획 CRUD 및 상태 관리 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/production/prod-plans
 * 2. **상태 워크플로우**: DRAFT → CONFIRMED → CLOSED
 * 3. **일괄 등록**: POST /bulk (엑셀 업로드 데이터)
 *
 * API 구조:
 * - GET    /                     : 목록 조회
 * - GET    /summary/:month       : 월간 집계
 * - POST   /                     : 개별 등록
 * - POST   /bulk                 : 일괄 등록
 * - PUT    /:id                  : 수정
 * - DELETE /:id                  : 삭제
 * - POST   /:id/confirm          : 확정
 * - POST   /bulk-confirm         : 일괄 확정
 * - POST   /:id/close            : 마감
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
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ProdPlanService } from '../services/prod-plan.service';
import {
  CreateProdPlanDto,
  BulkCreateProdPlanDto,
  UpdateProdPlanDto,
  ProdPlanQueryDto,
} from '../dto/prod-plan.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('생산관리 - 월간생산계획')
@Controller('production/prod-plans')
export class ProdPlanController {
  constructor(private readonly prodPlanService: ProdPlanService) {}

  @Get()
  @ApiOperation({ summary: '생산계획 목록 조회', description: '필터링 및 페이지네이션 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ProdPlanQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.prodPlanService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('summary/:month')
  @ApiOperation({ summary: '월간 집계', description: 'FG/WIP별 수량, 상태별 건수' })
  @ApiParam({ name: 'month', description: '계획월 (YYYY-MM)', example: '2026-03' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummary(@Param('month') month: string) {
    const data = await this.prodPlanService.getSummary(month);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '생산계획 개별 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async create(@Body() dto: CreateProdPlanDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.prodPlanService.create(dto, company, plant);
    return ResponseUtil.success(data, '생산계획이 등록되었습니다.');
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '생산계획 일괄 등록 (엑셀)', description: '엑셀 파싱 데이터를 일괄 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async bulkCreate(@Body() dto: BulkCreateProdPlanDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.prodPlanService.bulkCreate(dto, company, plant);
    return ResponseUtil.success(data, `${data.count}건의 생산계획이 등록되었습니다.`);
  }

  @Put(':id')
  @ApiOperation({ summary: '생산계획 수정', description: 'DRAFT 상태만 수정 가능' })
  @ApiParam({ name: 'id', description: '계획 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProdPlanDto) {
    const data = await this.prodPlanService.update(id, dto);
    return ResponseUtil.success(data, '생산계획이 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 삭제', description: 'DRAFT 상태만 삭제 가능' })
  @ApiParam({ name: 'id', description: '계획 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.prodPlanService.delete(id);
    return ResponseUtil.success(null, '생산계획이 삭제되었습니다.');
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 확정', description: 'DRAFT → CONFIRMED' })
  @ApiParam({ name: 'id', description: '계획 ID' })
  @ApiResponse({ status: 200, description: '확정 성공' })
  async confirm(@Param('id', ParseIntPipe) id: number) {
    const data = await this.prodPlanService.confirm(id);
    return ResponseUtil.success(data, '생산계획이 확정되었습니다.');
  }

  @Post('bulk-confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 일괄 확정' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'number' } } } } })
  @ApiResponse({ status: 200, description: '확정 성공' })
  async bulkConfirm(@Body('ids') ids: number[]) {
    const result = await this.prodPlanService.bulkConfirm(ids);
    return ResponseUtil.success(result, `${result.count}건의 생산계획이 확정되었습니다.`);
  }

  @Post(':id/unconfirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 확정 취소', description: 'CONFIRMED → DRAFT' })
  @ApiParam({ name: 'id', description: '계획 ID' })
  @ApiResponse({ status: 200, description: '확정 취소 성공' })
  async unconfirm(@Param('id', ParseIntPipe) id: number) {
    const data = await this.prodPlanService.unconfirm(id);
    return ResponseUtil.success(data, '생산계획 확정이 취소되었습니다.');
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 마감', description: 'CONFIRMED → CLOSED' })
  @ApiParam({ name: 'id', description: '계획 ID' })
  @ApiResponse({ status: 200, description: '마감 성공' })
  async close(@Param('id', ParseIntPipe) id: number) {
    const data = await this.prodPlanService.close(id);
    return ResponseUtil.success(data, '생산계획이 마감되었습니다.');
  }
}
