/**
 * @file src/modules/material/controllers/po-status.controller.ts
 * @description PO현황 조회 전용 API 컨트롤러
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PoStatusService } from '../services/po-status.service';
import { PoStatusQueryDto } from '../dto/po-status.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - PO현황')
@Controller('material/po-status')
export class PoStatusController {
  constructor(private readonly poStatusService: PoStatusService) {}

  @Get()
  @ApiOperation({ summary: 'PO 현황 목록 조회' })
  async findAll(@Query() query: PoStatusQueryDto) {
    const result = await this.poStatusService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }
}
