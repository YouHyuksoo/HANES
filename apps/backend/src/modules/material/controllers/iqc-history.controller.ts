/**
 * @file src/modules/material/controllers/iqc-history.controller.ts
 * @description IQC 이력 조회 전용 API 컨트롤러
 */

import { Controller, Get, Post, Query, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IqcHistoryService } from '../services/iqc-history.service';
import { IqcHistoryQueryDto, CreateIqcResultDto, CancelIqcResultDto } from '../dto/iqc-history.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - IQC이력')
@Controller('material/iqc-history')
export class IqcHistoryController {
  constructor(private readonly iqcHistoryService: IqcHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'IQC 이력 목록 조회' })
  async findAll(@Query() query: IqcHistoryQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.iqcHistoryService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'IQC 검사결과 등록 (LOT 상태 업데이트 + 이력 생성)' })
  async createResult(@Body() dto: CreateIqcResultDto) {
    const data = await this.iqcHistoryService.createResult(dto);
    return ResponseUtil.success(data, 'IQC 검사결과가 등록되었습니다.');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'IQC 판정 취소 (LOT iqcStatus → PENDING 복원)' })
  async cancel(@Param('id') id: string, @Body() dto: CancelIqcResultDto) {
    const data = await this.iqcHistoryService.cancel(id, dto);
    return ResponseUtil.success(data, 'IQC 판정이 취소되었습니다.');
  }
}
