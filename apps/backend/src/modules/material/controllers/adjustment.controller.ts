/**
 * @file src/modules/material/controllers/adjustment.controller.ts
 * @description 재고보정 API 컨트롤러
 *
 * 초보자 가이드:
 * - POST /material/adjustment          → 즉시 승인 보정 (PC 화면)
 * - POST /material/adjustment/pending  → 승인 대기 보정 (PDA)
 * - PATCH /material/adjustment/:id/approve → 승인 (재고 반영)
 * - PATCH /material/adjustment/:id/reject  → 반려 (재고 변동 없음)
 */

import { Controller, Get, Post, Patch, Body, Query, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AdjustmentService } from '../services/adjustment.service';
import { CreateAdjustmentDto, AdjustmentQueryDto, ApproveAdjustmentDto } from '../dto/adjustment.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 재고보정')
@Controller('material/adjustment')
export class AdjustmentController {
  constructor(private readonly adjustmentService: AdjustmentService) {}

  @Get()
  @ApiOperation({ summary: '재고보정 이력 조회' })
  async findAll(@Query() query: AdjustmentQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.adjustmentService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재고보정 즉시 승인 등록 (PC)' })
  async create(@Body() dto: CreateAdjustmentDto) {
    const data = await this.adjustmentService.create(dto);
    return ResponseUtil.success(data, '재고가 보정되었습니다.');
  }

  @Post('pending')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재고보정 승인 대기 등록 (PDA) — 재고 즉시 반영 안 함' })
  async createPending(@Body() dto: CreateAdjustmentDto) {
    const data = await this.adjustmentService.createPending(dto);
    return ResponseUtil.success(data, '보정 요청이 등록되었습니다. 승인 후 재고에 반영됩니다.');
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: '재고보정 승인 — PENDING → APPROVED, 재고 실반영' })
  @ApiParam({ name: 'id', description: 'InvAdjLog PK' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveAdjustmentDto,
  ) {
    const data = await this.adjustmentService.approve(id, dto.approvedBy);
    return ResponseUtil.success(data, '보정이 승인되었습니다. 재고에 반영되었습니다.');
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: '재고보정 반려 — PENDING → REJECTED, 재고 변동 없음' })
  @ApiParam({ name: 'id', description: 'InvAdjLog PK' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveAdjustmentDto,
  ) {
    const data = await this.adjustmentService.reject(id, dto.approvedBy);
    return ResponseUtil.success(data, '보정 요청이 반려되었습니다.');
  }
}
