/**
 * @file src/modules/material/controllers/scrap.controller.ts
 * @description 자재폐기 API 컨트롤러
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ScrapService } from '../services/scrap.service';
import { CreateScrapDto, ScrapQueryDto } from '../dto/scrap.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 자재폐기')
@Controller('material/scrap')
export class ScrapController {
  constructor(private readonly scrapService: ScrapService) {}

  @Get()
  @ApiOperation({ summary: '폐기 이력 조회' })
  async findAll(@Query() query: ScrapQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.scrapService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '자재 폐기 등록' })
  async create(@Body() dto: CreateScrapDto) {
    const data = await this.scrapService.create(dto);
    return ResponseUtil.success(data, '자재가 폐기 처리되었습니다.');
  }
}
