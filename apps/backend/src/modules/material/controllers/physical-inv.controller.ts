/**
 * @file src/modules/material/controllers/physical-inv.controller.ts
 * @description 재고실사 API 컨트롤러
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PhysicalInvService } from '../services/physical-inv.service';
import { CreatePhysicalInvDto, PhysicalInvQueryDto, PhysicalInvHistoryQueryDto } from '../dto/physical-inv.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 재고실사')
@Controller('material/physical-inv')
export class PhysicalInvController {
  constructor(private readonly physicalInvService: PhysicalInvService) {}

  @Get()
  @ApiOperation({ summary: '실사 대상 재고 목록 조회' })
  async findStocks(@Query() query: PhysicalInvQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.physicalInvService.findStocks(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('history')
  @ApiOperation({ summary: '재고실사 이력 조회' })
  async findHistory(@Query() query: PhysicalInvHistoryQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.physicalInvService.findHistory(query, company, plant);
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
