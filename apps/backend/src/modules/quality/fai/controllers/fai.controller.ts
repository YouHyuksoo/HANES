/**
 * @file fai.controller.ts
 * @description 초물검사(FAI) API 컨트롤러 — IATF 16949 8.3.4.4
 *
 * 초보자 가이드:
 * 1. **FAI 요청 API**: /api/v1/quality/fai
 *    - GET    /fai              : 목록 조회 (페이지네이션)
 *    - GET    /fai/stats        : 상태별 통계
 *    - GET    /fai/:id          : 단건 조회 (items 포함)
 *    - POST   /fai              : 등록
 *    - PUT    /fai/:id          : 수정
 *    - DELETE /fai/:id          : 삭제
 *    - PATCH  /fai/:id/start    : 검사 시작 (REQUESTED → SAMPLING)
 *    - PATCH  /fai/:id/complete : 검사 완료 (판정)
 *    - PATCH  /fai/:id/approve  : 승인
 *    - POST   /fai/:id/items    : 검사항목 일괄 등록
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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { JwtAuthGuard, AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { FaiService } from '../services/fai.service';
import {
  CreateFaiDto,
  UpdateFaiDto,
  FaiQueryDto,
  CompleteFaiDto,
  FaiItemDto,
} from '../dto/fai.dto';

@ApiTags('품질관리 - 초물검사')
@UseGuards(JwtAuthGuard)
@Controller('quality/fai')
export class FaiController {
  constructor(private readonly faiService: FaiService) {}

  // ===== 통계 API (목록 조회보다 먼저 정의) =====

  @Get('stats')
  @ApiOperation({ summary: 'FAI 통계', description: '상태별 건수' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.faiService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  // ===== FAI 요청 CRUD =====

  @Get()
  @ApiOperation({ summary: 'FAI 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: FaiQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.faiService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'FAI 단건 조회', description: '검사항목(items) 포함' })
  @ApiParam({ name: 'id', description: 'FAI 번호 (faiNo)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: 'FAI 요청 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.faiService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'FAI 등록', description: '초물검사 요청 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateFaiDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.faiService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '초물검사가 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'FAI 수정' })
  @ApiParam({ name: 'id', description: 'FAI 번호 (faiNo)' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFaiDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.faiService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '초물검사가 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'FAI 삭제' })
  @ApiParam({ name: 'id', description: 'FAI 번호 (faiNo)' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.faiService.delete(id);
    return ResponseUtil.success(null, '초물검사가 삭제되었습니다.');
  }

  // ===== 상태 전이 =====

  @Patch(':id/start')
  @ApiOperation({ summary: '검사 시작', description: 'REQUESTED → SAMPLING' })
  @ApiParam({ name: 'id', description: 'FAI 번호 (faiNo)' })
  @ApiResponse({ status: 200, description: '시작 성공' })
  async start(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.faiService.start(id, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '검사가 시작되었습니다.');
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: '검사 완료', description: '판정 결과 입력 (자동/수동)' })
  @ApiParam({ name: 'id', description: 'FAI 번호 (faiNo)' })
  @ApiResponse({ status: 200, description: '완료 성공' })
  async complete(
    @Param('id') id: string,
    @Body() dto: CompleteFaiDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.faiService.complete(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '검사가 완료되었습니다.');
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'FAI 승인' })
  @ApiParam({ name: 'id', description: 'FAI 번호 (faiNo)' })
  @ApiResponse({ status: 200, description: '승인 성공' })
  async approve(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.faiService.approve(id, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '승인되었습니다.');
  }

  // ===== 검사항목 =====

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '검사항목 일괄 등록', description: '기존 항목 교체' })
  @ApiParam({ name: 'id', description: 'FAI 번호 (faiNo)' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async addItems(
    @Param('id') id: string,
    @Body() items: FaiItemDto[],
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.faiService.addItems(
      id,
      items,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '검사항목이 등록되었습니다.');
  }
}
