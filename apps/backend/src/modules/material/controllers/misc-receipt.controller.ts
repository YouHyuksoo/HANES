/**
 * @file src/modules/material/controllers/misc-receipt.controller.ts
 * @description 기타입고 API 컨트롤러
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MiscReceiptService } from '../services/misc-receipt.service';
import { CreateMiscReceiptDto, MiscReceiptQueryDto } from '../dto/misc-receipt.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - 기타입고')
@Controller('material/misc-receipt')
export class MiscReceiptController {
  constructor(private readonly miscReceiptService: MiscReceiptService) {}

  @Get()
  @ApiOperation({ summary: '기타입고 이력 조회' })
  async findAll(@Query() query: MiscReceiptQueryDto) {
    const result = await this.miscReceiptService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '기타입고 등록' })
  async create(@Body() dto: CreateMiscReceiptDto) {
    const data = await this.miscReceiptService.create(dto);
    return ResponseUtil.success(data, '기타입고가 등록되었습니다.');
  }
}
