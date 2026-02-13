/**
 * @file src/modules/material/controllers/hold.controller.ts
 * @description 재고홀드 API 컨트롤러
 */

import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HoldService } from '../services/hold.service';
import { HoldActionDto, ReleaseHoldDto, HoldQueryDto } from '../dto/hold.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - 재고홀드')
@Controller('material/hold')
export class HoldController {
  constructor(private readonly holdService: HoldService) {}

  @Get()
  @ApiOperation({ summary: 'LOT 목록 조회 (홀드 관리)' })
  async findAll(@Query() query: HoldQueryDto) {
    const result = await this.holdService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post('hold')
  @ApiOperation({ summary: 'LOT 홀드 처리' })
  async hold(@Body() dto: HoldActionDto) {
    const data = await this.holdService.hold(dto);
    return ResponseUtil.success(data, 'LOT이 홀드 처리되었습니다.');
  }

  @Post('release')
  @ApiOperation({ summary: 'LOT 홀드 해제' })
  async release(@Body() dto: ReleaseHoldDto) {
    const data = await this.holdService.release(dto);
    return ResponseUtil.success(data, 'LOT 홀드가 해제되었습니다.');
  }
}
