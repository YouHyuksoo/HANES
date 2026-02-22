/**
 * @file src/modules/material/controllers/receipt-cancel.controller.ts
 * @description 입고취소 API 컨트롤러
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReceiptCancelService } from '../services/receipt-cancel.service';
import { CreateReceiptCancelDto, ReceiptCancelQueryDto } from '../dto/receipt-cancel.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 입고취소')
@Controller('material/receipt-cancel')
export class ReceiptCancelController {
  constructor(private readonly receiptCancelService: ReceiptCancelService) {}

  @Get()
  @ApiOperation({ summary: '취소 가능한 입고 트랜잭션 조회' })
  async findCancellable(@Query() query: ReceiptCancelQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.receiptCancelService.findCancellable(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '입고 취소 (역분개)' })
  async cancel(@Body() dto: CreateReceiptCancelDto) {
    const data = await this.receiptCancelService.cancel(dto);
    return ResponseUtil.success(data, '입고가 취소되었습니다.');
  }
}
