/**
 * @file src/modules/quality/controllers/capa.controller.ts
 * @description CAPA 시정/예방조치 API 컨트롤러 — IATF 16949 10.2
 *
 * 초보자 가이드:
 * 1. **CAPA API**: /api/v1/quality/capas
 *    - GET    /capas              : 목록 조회
 *    - GET    /capas/stats        : 통계
 *    - GET    /capas/:id          : 단건 조회 (actions 포함)
 *    - POST   /capas              : 등록
 *    - PUT    /capas/:id          : 수정
 *    - DELETE /capas/:id          : 삭제 (OPEN만)
 *    - PATCH  /capas/:id/analyze  : 원인 분석 완료
 *    - PATCH  /capas/:id/plan     : 조치 계획 등록
 *    - PATCH  /capas/:id/start    : 조치 시작
 *    - PATCH  /capas/:id/verify   : 유효성 검증
 *    - PATCH  /capas/:id/close    : 종료
 *    - POST   /capas/:id/actions  : 조치항목 추가
 *    - PATCH  /capas/:id/actions/:actionId : 조치항목 수정
 *
 * 2. **인증**: @Company(), @Plant() 데코레이터로 테넌시, req.user.id로 사용자 ID
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
import { CapaService } from '../services/capa.service';
import {
  CreateCapaDto,
  UpdateCapaDto,
  CapaQueryDto,
  AnalyzeCapaDto,
  PlanCapaDto,
  VerifyCapaDto,
  CAPAActionItemDto,
} from '../dto/capa.dto';

@ApiTags('품질관리 - CAPA')
@Controller('quality')
export class CapaController {
  constructor(private readonly capaService: CapaService) {}

  // ===== 통계 (목록보다 먼저 정의) =====

  @Get('capas/stats')
  @ApiOperation({ summary: 'CAPA 통계', description: '상태/유형별 건수' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.capaService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  // ===== CAPA CRUD =====

  @Get('capas')
  @ApiOperation({ summary: 'CAPA 목록 조회', description: '페이지네이션 및 필터링' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: CapaQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.capaService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('capas/:id')
  @ApiOperation({ summary: 'CAPA 단건 조회', description: '조치 항목 포함' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: 'CAPA 없음' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.capaService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post('capas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'CAPA 등록', description: '시정/예방조치 요청 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateCapaDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.create(
      dto, company, plant, req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'CAPA가 등록되었습니다.');
  }

  @Put('capas/:id')
  @ApiOperation({ summary: 'CAPA 수정' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCapaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.update(id, dto, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'CAPA가 수정되었습니다.');
  }

  @Delete('capas/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CAPA 삭제', description: 'OPEN 상태에서만 가능' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.capaService.delete(id);
    return ResponseUtil.success(null, 'CAPA가 삭제되었습니다.');
  }

  // ===== 상태 전이 =====

  @Patch('capas/:id/analyze')
  @ApiOperation({ summary: '원인 분석 완료', description: 'OPEN → ANALYZING' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 200, description: '분석 등록 성공' })
  async analyze(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnalyzeCapaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.analyze(id, dto, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '원인 분석이 등록되었습니다.');
  }

  @Patch('capas/:id/plan')
  @ApiOperation({ summary: '조치 계획 등록', description: 'ANALYZING → ACTION_PLANNED' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 200, description: '계획 등록 성공' })
  async plan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PlanCapaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.plan(id, dto, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '조치 계획이 등록되었습니다.');
  }

  @Patch('capas/:id/start')
  @ApiOperation({ summary: '조치 시작', description: 'ACTION_PLANNED → IN_PROGRESS' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 200, description: '조치 시작 성공' })
  async start(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.start(id, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '조치가 시작되었습니다.');
  }

  @Patch('capas/:id/verify')
  @ApiOperation({ summary: '유효성 검증', description: 'IN_PROGRESS → VERIFYING' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 200, description: '검증 등록 성공' })
  async verify(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifyCapaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.verify(id, dto, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '유효성 검증이 등록되었습니다.');
  }

  @Patch('capas/:id/close')
  @ApiOperation({ summary: 'CAPA 종료', description: 'VERIFYING → CLOSED' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 200, description: '종료 성공' })
  async close(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.close(id, req.user?.id ?? 'system');
    return ResponseUtil.success(data, 'CAPA가 종료되었습니다.');
  }

  // ===== 조치 항목 =====

  @Post('capas/:id/actions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '조치항목 추가' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiResponse({ status: 201, description: '추가 성공' })
  async addAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CAPAActionItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.addAction(id, dto, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '조치항목이 추가되었습니다.');
  }

  @Patch('capas/:id/actions/:actionId')
  @ApiOperation({ summary: '조치항목 수정' })
  @ApiParam({ name: 'id', description: 'CAPA ID' })
  @ApiParam({ name: 'actionId', description: '조치항목 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateAction(
    @Param('id', ParseIntPipe) id: number,
    @Param('actionId', ParseIntPipe) actionId: number,
    @Body() dto: Partial<CAPAActionItemDto>,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.capaService.updateAction(
      id, actionId, dto, req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '조치항목이 수정되었습니다.');
  }
}
