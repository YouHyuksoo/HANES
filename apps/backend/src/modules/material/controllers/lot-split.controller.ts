/**
 * @file src/modules/material/controllers/lot-split.controller.ts
 * @description 자재 LOT 분할 API 컨트롤러
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LotSplitService } from '../services/lot-split.service';
import { LotSplitDto, LotSplitQueryDto } from '../dto/lot-split.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - LOT분할')
@Controller('material/lot-split')
export class LotSplitController {
  constructor(private readonly lotSplitService: LotSplitService) {}

  @Get()
  @ApiOperation({ summary: '분할 가능한 LOT 목록 조회' })
  async findSplittable(@Query() query: LotSplitQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.lotSplitService.findSplittableLots(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'LOT 분할 실행' })
  async split(@Body() dto: LotSplitDto) {
    const data = await this.lotSplitService.split(dto);
    return ResponseUtil.success(data, 'LOT이 분할되었습니다.');
  }
}
