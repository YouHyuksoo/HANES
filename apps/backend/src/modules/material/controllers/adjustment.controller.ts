/**
 * @file src/modules/material/controllers/adjustment.controller.ts
 * @description 재고보정 API 컨트롤러
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdjustmentService } from '../services/adjustment.service';
import { CreateAdjustmentDto, AdjustmentQueryDto } from '../dto/adjustment.dto';
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
  @ApiOperation({ summary: '재고보정 등록' })
  async create(@Body() dto: CreateAdjustmentDto) {
    const data = await this.adjustmentService.create(dto);
    return ResponseUtil.success(data, '재고가 보정되었습니다.');
  }
}
