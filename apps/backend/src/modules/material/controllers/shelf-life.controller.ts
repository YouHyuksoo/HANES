/**
 * @file src/modules/material/controllers/shelf-life.controller.ts
 * @description 유수명자재 조회 전용 API 컨트롤러
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ShelfLifeService } from '../services/shelf-life.service';
import { ShelfLifeQueryDto } from '../dto/shelf-life.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - 유수명자재')
@Controller('material/shelf-life')
export class ShelfLifeController {
  constructor(private readonly shelfLifeService: ShelfLifeService) {}

  @Get()
  @ApiOperation({ summary: '유수명자재 목록 조회' })
  async findAll(@Query() query: ShelfLifeQueryDto) {
    const result = await this.shelfLifeService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }
}
