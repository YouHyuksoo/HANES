/**
 * @file ppap.controller.ts
 * @description PPAP(Production Part Approval Process) API 컨트롤러 — IATF 16949
 *
 * 초보자 가이드:
 * 1. **PPAP API**: /api/v1/quality/ppap
 *    - GET    /ppap               : 목록 조회 (페이지네이션)
 *    - GET    /ppap/:id           : 단건 조회
 *    - POST   /ppap               : 등록
 *    - PUT    /ppap/:id           : 수정
 *    - DELETE /ppap/:id           : 삭제 (DRAFT만)
 *    - PATCH  /ppap/submit/:id    : 제출 (DRAFT → SUBMITTED)
 *    - PATCH  /ppap/approve/:id   : 승인 (SUBMITTED → APPROVED)
 *    - PATCH  /ppap/reject/:id    : 반려 (SUBMITTED → REJECTED)
 *    - GET    /ppap/required-elements/:level : Level별 필수 요소
 *    - GET    /ppap/completion/:id : 완성률 조회
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
import { PpapService } from '../services/ppap.service';
import {
  CreatePpapDto,
  UpdatePpapDto,
  PpapFilterDto,
} from '../dto/ppap.dto';

@ApiTags('품질관리 - PPAP')
@Controller('quality/ppap')
export class PpapController {
  constructor(private readonly ppapService: PpapService) {}

  // ===== Level별 필수 요소 (목록 조회보다 먼저 정의) =====

  @Get('required-elements/:level')
  @ApiOperation({
    summary: 'PPAP Level별 필수 요소 조회',
    description: 'Level 1~5에 따른 필수/보관 요소 목록',
  })
  @ApiParam({ name: 'level', description: 'PPAP Level (1~5)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getRequiredElements(@Param('level', ParseIntPipe) level: number) {
    const data = this.ppapService.getRequiredElements(level);
    return ResponseUtil.success(data);
  }

  // ===== 완성률 조회 =====

  @Get('completion/:id')
  @ApiOperation({
    summary: 'PPAP 완성률 조회',
    description: '필수 요소 대비 완료된 비율',
  })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getCompletionRate(@Param('id') id: string) {
    const data = await this.ppapService.getCompletionRate(id);
    return ResponseUtil.success(data);
  }

  // ===== CRUD =====

  @Get()
  @ApiOperation({
    summary: 'PPAP 목록 조회',
    description: '페이지네이션 및 필터링 지원',
  })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: PpapFilterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.ppapService.findAll(query, company, plant);
    return ResponseUtil.paged(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'PPAP 단건 조회' })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: 'PPAP 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.ppapService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'PPAP 등록', description: 'DRAFT 상태로 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreatePpapDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ppapService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'PPAP가 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'PPAP 수정' })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePpapDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ppapService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'PPAP가 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PPAP 삭제',
    description: 'DRAFT 상태에서만 가능',
  })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.ppapService.delete(id);
    return ResponseUtil.success(null, 'PPAP가 삭제되었습니다.');
  }

  // ===== 상태 전이 =====

  @Patch('submit/:id')
  @ApiOperation({
    summary: 'PPAP 제출',
    description: 'DRAFT → SUBMITTED',
  })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '제출 성공' })
  async submit(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ppapService.submit(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'PPAP가 제출되었습니다.');
  }

  @Patch('approve/:id')
  @ApiOperation({
    summary: 'PPAP 승인',
    description: 'SUBMITTED → APPROVED',
  })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '승인 성공' })
  async approve(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ppapService.approve(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'PPAP가 승인되었습니다.');
  }

  @Patch('reject/:id')
  @ApiOperation({
    summary: 'PPAP 반려',
    description: 'SUBMITTED → REJECTED',
  })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '반려 완료' })
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ppapService.reject(
      id,
      reason,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'PPAP가 반려되었습니다.');
  }

  @Patch('cancel-approve/:id')
  @ApiOperation({
    summary: 'PPAP 승인 취소',
    description: 'APPROVED → SUBMITTED',
  })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '승인 취소 완료' })
  async cancelApproval(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ppapService.cancelApproval(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'PPAP 승인이 취소되었습니다.');
  }

  @Patch('cancel-submit/:id')
  @ApiOperation({
    summary: 'PPAP 제출 취소',
    description: 'SUBMITTED → DRAFT',
  })
  @ApiParam({ name: 'id', description: 'PPAP ID' })
  @ApiResponse({ status: 200, description: '제출 취소 완료' })
  async cancelSubmit(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.ppapService.cancelSubmit(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'PPAP 제출이 취소되었습니다.');
  }
}
