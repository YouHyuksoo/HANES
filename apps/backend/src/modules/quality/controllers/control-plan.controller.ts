/**
 * @file control-plan.controller.ts
 * @description 관리계획서(Control Plan) API 컨트롤러 — IATF 16949 8.5.1.1
 *
 * 초보자 가이드:
 * 1. **관리계획서 API**: /api/v1/quality/control-plans
 *    - GET    /control-plans             : 목록 조회 (페이지네이션)
 *    - GET    /control-plans/:id         : 단건 조회 (항목 포함)
 *    - POST   /control-plans             : 등록 (DRAFT)
 *    - PUT    /control-plans/:id         : 수정 (DRAFT만)
 *    - DELETE /control-plans/:id         : 삭제 (DRAFT만)
 *    - PATCH  /control-plans/approve/:id : 승인 (DRAFT/REVIEW → APPROVED)
 *    - POST   /control-plans/revise/:id  : 개정 (APPROVED → 새 버전 DRAFT)
 *    - GET    /control-plans/by-item/:itemCode : 품목별 유효 관리계획서
 *
 * 2. **인증**: @Company(), @Plant() 데코레이터로 테넌시 정보, req.user.id로 사용자 ID 추출
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { ControlPlanService } from '../services/control-plan.service';
import {
  CreateControlPlanDto,
  UpdateControlPlanDto,
  ControlPlanFilterDto,
} from '../dto/control-plan.dto';

@ApiTags('품질관리 - 관리계획서')
@Controller('quality')
export class ControlPlanController {
  constructor(private readonly controlPlanService: ControlPlanService) {}

  // ===== 품목별 조회 (목록 조회보다 먼저 정의) =====

  @Get('control-plans/by-item/:itemCode')
  @ApiOperation({
    summary: '품목별 관리계획서 조회',
    description: '해당 품목의 최신 APPROVED 관리계획서',
  })
  @ApiParam({ name: 'itemCode', description: '품목코드' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getByItem(
    @Param('itemCode') itemCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.controlPlanService.getByItem(
      itemCode,
      company,
      plant,
    );
    return ResponseUtil.success(data);
  }

  // ===== CRUD =====

  @Get('control-plans')
  @ApiOperation({
    summary: '관리계획서 목록 조회',
    description: '페이지네이션 및 필터링 지원',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: ControlPlanFilterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.controlPlanService.findAll(
      query,
      company,
      plant,
    );
    return ResponseUtil.paged(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('control-plans/:id')
  @ApiOperation({ summary: '관리계획서 단건 조회', description: '항목 포함' })
  @ApiParam({ name: 'id', description: '관리계획서 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '관리계획서 없음' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.controlPlanService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post('control-plans')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '관리계획서 등록',
    description: 'DRAFT 상태로 생성 (항목 포함)',
  })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateControlPlanDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.controlPlanService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '관리계획서가 등록되었습니다.');
  }

  @Put('control-plans/:id')
  @ApiOperation({ summary: '관리계획서 수정', description: 'DRAFT 상태에서만 가능' })
  @ApiParam({ name: 'id', description: '관리계획서 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateControlPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.controlPlanService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '관리계획서가 수정되었습니다.');
  }

  @Delete('control-plans/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '관리계획서 삭제',
    description: 'DRAFT 상태에서만 가능',
  })
  @ApiParam({ name: 'id', description: '관리계획서 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.controlPlanService.delete(id);
    return ResponseUtil.success(null, '관리계획서가 삭제되었습니다.');
  }

  // ===== 상태 전이 =====

  @Patch('control-plans/approve/:id')
  @ApiOperation({
    summary: '관리계획서 승인',
    description: 'DRAFT/REVIEW → APPROVED',
  })
  @ApiParam({ name: 'id', description: '관리계획서 ID' })
  @ApiResponse({ status: 200, description: '승인 성공' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.controlPlanService.approve(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '관리계획서가 승인되었습니다.');
  }

  @Post('control-plans/revise/:id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '관리계획서 개정',
    description: '기존 OBSOLETE, 새 버전 DRAFT 생성',
  })
  @ApiParam({ name: 'id', description: '관리계획서 ID' })
  @ApiResponse({ status: 201, description: '개정 성공' })
  async revise(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.controlPlanService.revise(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '관리계획서가 개정되었습니다.');
  }
}
