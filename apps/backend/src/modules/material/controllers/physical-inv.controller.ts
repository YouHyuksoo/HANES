/**
 * @file src/modules/material/controllers/physical-inv.controller.ts
 * @description 재고실사 API 컨트롤러
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PhysicalInvService } from '../services/physical-inv.service';
import { CreatePhysicalInvDto, PhysicalInvQueryDto } from '../dto/physical-inv.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - 재고실사')
@Controller('material/physical-inv')
export class PhysicalInvController {
  constructor(private readonly physicalInvService: PhysicalInvService) {}

  @Get()
  @ApiOperation({ summary: '실사 대상 재고 목록 조회' })
  async findStocks(@Query() query: PhysicalInvQueryDto) {
    const result = await this.physicalInvService.findStocks(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재고실사 결과 반영' })
  async apply(@Body() dto: CreatePhysicalInvDto) {
    const data = await this.physicalInvService.applyCount(dto);
    return ResponseUtil.success(data, '재고실사가 반영되었습니다.');
  }
}
