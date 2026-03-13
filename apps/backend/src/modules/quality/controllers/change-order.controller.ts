/**
 * @file change-order.controller.ts
 * @description 4M 변경점관리 API 컨트롤러 — IATF 16949 8.5.6
 *
 * 초보자 가이드:
 * 1. **변경점 API**: /api/v1/quality/changes
 *    - GET    /changes          : 목록 조회 (페이지네이션)
 *    - GET    /changes/stats    : 상태별 통계
 *    - GET    /changes/:id      : 단건 조회
 *    - POST   /changes          : 등록
 *    - PUT    /changes/:id      : 수정
 *    - DELETE /changes/:id      : 삭제 (DRAFT만)
 *    - PATCH  /changes/:id/submit  : 제출 (DRAFT → SUBMITTED)
 *    - PATCH  /changes/:id/review  : 검토 (SUBMITTED → APPROVED/REJECTED)
 *    - PATCH  /changes/:id/approve : 최종 승인
 *    - PATCH  /changes/:id/start   : 시행 시작
 *    - PATCH  /changes/:id/complete: 완료
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
import { ChangeOrderService } from '../services/change-order.service';
import {
  CreateChangeOrderDto,
  UpdateChangeOrderDto,
  ChangeOrderQueryDto,
  ReviewChangeOrderDto,
} from '../dto/change-order.dto';

@ApiTags('품질관리 - 변경점관리')
@Controller('quality')
export class ChangeOrderController {
  constructor(private readonly changeOrderService: ChangeOrderService) {}

  // ===== 통계 API (목록 조회보다 먼저 정의) =====

  @Get('changes/stats')
  @ApiOperation({ summary: '변경점 통계', description: '상태별 건수' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.changeOrderService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  // ===== CRUD =====

  @Get('changes')
  @ApiOperation({ summary: '변경점 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: ChangeOrderQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.changeOrderService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('changes/:id')
  @ApiOperation({ summary: '변경점 단건 조회' })
  @ApiParam({ name: 'id', description: '변경점 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '변경점 없음' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.changeOrderService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post('changes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '변경점 등록', description: 'DRAFT 상태로 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateChangeOrderDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.changeOrderService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '변경점이 등록되었습니다.');
  }

  @Put('changes/:id')
  @ApiOperation({ summary: '변경점 수정' })
  @ApiParam({ name: 'id', description: '변경점 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChangeOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.changeOrderService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '변경점이 수정되었습니다.');
  }

  @Delete('changes/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '변경점 삭제', description: 'DRAFT 상태에서만 가능' })
  @ApiParam({ name: 'id', description: '변경점 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.changeOrderService.delete(id);
    return ResponseUtil.success(null, '변경점이 삭제되었습니다.');
  }

  // ===== 상태 전이 =====

  @Patch('changes/:id/submit')
  @ApiOperation({ summary: '변경점 제출', description: 'DRAFT → SUBMITTED' })
  @ApiParam({ name: 'id', description: '변경점 ID' })
  @ApiResponse({ status: 200, description: '제출 성공' })
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.changeOrderService.submit(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '변경점이 제출되었습니다.');
  }

  @Patch('changes/:id/review')
  @ApiOperation({
    summary: '변경점 검토',
    description: 'SUBMITTED → APPROVED 또는 REJECTED',
  })
  @ApiParam({ name: 'id', description: '변경점 ID' })
  @ApiResponse({ status: 200, description: '검토 완료' })
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewChangeOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.changeOrderService.review(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data);
  }

  @Patch('changes/:id/approve')
  @ApiOperation({ summary: '변경점 최종 승인' })
  @ApiParam({ name: 'id', description: '변경점 ID' })
  @ApiResponse({ status: 200, description: '승인 완료' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewChangeOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.changeOrderService.approve(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '변경점이 승인되었습니다.');
  }

  @Patch('changes/:id/start')
  @ApiOperation({ summary: '시행 시작', description: 'APPROVED → IN_PROGRESS' })
  @ApiParam({ name: 'id', description: '변경점 ID' })
  @ApiResponse({ status: 200, description: '시행 시작' })
  async start(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.changeOrderService.start(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '시행이 시작되었습니다.');
  }

  @Patch('changes/:id/complete')
  @ApiOperation({ summary: '변경점 완료', description: 'IN_PROGRESS → COMPLETED' })
  @ApiParam({ name: 'id', description: '변경점 ID' })
  @ApiResponse({ status: 200, description: '완료' })
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.changeOrderService.complete(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '변경점이 완료되었습니다.');
  }
}
