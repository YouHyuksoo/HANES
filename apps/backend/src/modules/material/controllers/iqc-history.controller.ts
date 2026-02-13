/**
 * @file src/modules/material/controllers/iqc-history.controller.ts
 * @description IQC 이력 조회 전용 API 컨트롤러
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IqcHistoryService } from '../services/iqc-history.service';
import { IqcHistoryQueryDto } from '../dto/iqc-history.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - IQC이력')
@Controller('material/iqc-history')
export class IqcHistoryController {
  constructor(private readonly iqcHistoryService: IqcHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'IQC 이력 목록 조회' })
  async findAll(@Query() query: IqcHistoryQueryDto) {
    const result = await this.iqcHistoryService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }
}
