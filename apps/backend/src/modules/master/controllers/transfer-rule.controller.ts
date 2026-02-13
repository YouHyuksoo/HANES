/**
 * @file src/modules/master/controllers/transfer-rule.controller.ts
 * @description 창고이동규칙 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/transfer-rules**: 이동규칙 목록 (창고 필터)
 * 2. **POST /master/transfer-rules**: 이동규칙 생성
 * 3. **PUT /master/transfer-rules/:id**: 이동규칙 수정
 * 4. **DELETE /master/transfer-rules/:id**: 이동규칙 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TransferRuleService } from '../services/transfer-rule.service';
import { CreateTransferRuleDto, UpdateTransferRuleDto, TransferRuleQueryDto } from '../dto/transfer-rule.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 창고이동규칙')
@Controller('master/transfer-rules')
export class TransferRuleController {
  constructor(private readonly transferRuleService: TransferRuleService) {}

  @Get()
  @ApiOperation({ summary: '창고이동규칙 목록 조회' })
  async findAll(@Query() query: TransferRuleQueryDto) {
    const result = await this.transferRuleService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '창고이동규칙 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.transferRuleService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '창고이동규칙 생성' })
  async create(@Body() dto: CreateTransferRuleDto) {
    const data = await this.transferRuleService.create(dto);
    return ResponseUtil.success(data, '창고이동규칙이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '창고이동규칙 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateTransferRuleDto) {
    const data = await this.transferRuleService.update(id, dto);
    return ResponseUtil.success(data, '창고이동규칙이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '창고이동규칙 삭제' })
  async delete(@Param('id') id: string) {
    await this.transferRuleService.delete(id);
    return ResponseUtil.success(null, '창고이동규칙이 삭제되었습니다.');
  }
}
