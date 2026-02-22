/**
 * @file src/modules/material/controllers/receiving.controller.ts
 * @description 입고관리 API 컨트롤러 - IQC 합격건 일괄/분할 입고
 *
 * 초보자 가이드:
 * 1. **GET /material/receiving**: 입고 이력 조회
 * 2. **GET /material/receiving/stats**: 입고 통계
 * 3. **GET /material/receiving/receivable**: 입고 가능 LOT 목록
 * 4. **POST /material/receiving**: 일괄/분할 입고 등록
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReceivingService } from '../services/receiving.service';
import { CreateBulkReceiveDto, ReceivingQueryDto } from '../dto/receiving.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 입고관리')
@Controller('material/receiving')
export class ReceivingController {
  constructor(private readonly receivingService: ReceivingService) {}

  @Get()
  @ApiOperation({ summary: '입고 이력 조회' })
  async findAll(@Query() query: ReceivingQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.receivingService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('stats')
  @ApiOperation({ summary: '입고 통계' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.receivingService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('receivable')
  @ApiOperation({ summary: '입고 가능 LOT 목록 (IQC 합격 + 미입고)' })
  async findReceivable(@Company() company: string, @Plant() plant: string) {
    const data = await this.receivingService.findReceivable(company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '일괄/분할 입고 등록' })
  async createBulkReceive(@Body() dto: CreateBulkReceiveDto) {
    const data = await this.receivingService.createBulkReceive(dto);
    return ResponseUtil.success(data, '입고가 등록되었습니다.');
  }
}
