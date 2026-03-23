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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ProdPlanService } from '../services/prod-plan.service';
import { AutoPlanService } from '../services/auto-plan.service';
import {
  CreateProdPlanDto,
  BulkCreateProdPlanDto,
  UpdateProdPlanDto,
  ProdPlanQueryDto,
  IssueJobOrderFromPlanDto,
  AutoGeneratePlanDto,
} from '../dto/prod-plan.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('생산관리 - 월간생산계획')
@UseGuards(JwtAuthGuard)
@Controller('production/prod-plans')
export class ProdPlanController {
  constructor(
    private readonly prodPlanService: ProdPlanService,
    private readonly autoPlanService: AutoPlanService,
  ) {}

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

  @Post('auto-generate/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '수주 조회', description: '미출하 수주 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async searchOrders(
    @Body() dto: AutoGeneratePlanDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.autoPlanService.search(dto, company, plant);
    return ResponseUtil.success(data);
  }

  @Post('auto-generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '수주 가져오기', description: '선택된 수주를 생산계획으로 추가' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async importOrders(
    @Body() dto: AutoGeneratePlanDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.autoPlanService.importOrders(dto, company, plant);
    return ResponseUtil.success(data, `${data.created}건의 생산계획이 추가되었습니다.`);
  }

  @Put(':id')
  @ApiOperation({ summary: '생산계획 수정', description: 'DRAFT 상태만 수정 가능' })
  @ApiParam({ name: 'id', description: '계획번호' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(@Param('id') id: string, @Body() dto: UpdateProdPlanDto) {
    const data = await this.prodPlanService.update(id, dto);
    return ResponseUtil.success(data, '생산계획이 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 삭제', description: 'DRAFT 상태만 삭제 가능' })
  @ApiParam({ name: 'id', description: '계획번호' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.prodPlanService.delete(id);
    return ResponseUtil.success(null, '생산계획이 삭제되었습니다.');
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 확정', description: 'DRAFT → CONFIRMED' })
  @ApiParam({ name: 'id', description: '계획번호' })
  @ApiResponse({ status: 200, description: '확정 성공' })
  async confirm(@Param('id') id: string) {
    const data = await this.prodPlanService.confirm(id);
    return ResponseUtil.success(data, '생산계획이 확정되었습니다.');
  }

  @Post('bulk-confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 일괄 확정' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } })
  @ApiResponse({ status: 200, description: '확정 성공' })
  async bulkConfirm(@Body('ids') ids: string[]) {
    const result = await this.prodPlanService.bulkConfirm(ids);
    return ResponseUtil.success(result, `${result.count}건의 생산계획이 확정되었습니다.`);
  }

  @Post(':id/unconfirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 확정 취소', description: 'CONFIRMED → DRAFT' })
  @ApiParam({ name: 'id', description: '계획번호' })
  @ApiResponse({ status: 200, description: '확정 취소 성공' })
  async unconfirm(@Param('id') id: string) {
    const data = await this.prodPlanService.unconfirm(id);
    return ResponseUtil.success(data, '생산계획 확정이 취소되었습니다.');
  }

  @Post(':id/issue-job-order')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '작업지시 발행', description: 'CONFIRMED 상태의 계획에서 작업지시를 발행합니다.' })
  @ApiParam({ name: 'id', description: '계획번호' })
  @ApiResponse({ status: 201, description: '발행 성공' })
  async issueJobOrder(
    @Param('id') planNo: string,
    @Body() dto: IssueJobOrderFromPlanDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.prodPlanService.issueJobOrder(planNo, dto, company, plant);
    return ResponseUtil.success(data, '작업지시가 발행되었습니다.');
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '생산계획 마감', description: 'CONFIRMED → CLOSED' })
  @ApiParam({ name: 'id', description: '계획번호' })
  @ApiResponse({ status: 200, description: '마감 성공' })
  async close(@Param('id') id: string) {
    const data = await this.prodPlanService.close(id);
    return ResponseUtil.success(data, '생산계획이 마감되었습니다.');
  }
}
