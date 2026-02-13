/**
 * @file src/modules/master/controllers/iqc-item.controller.ts
 * @description IQC 검사항목마스터 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/iqc-items**: 검사항목 목록 조회 (partId 필터)
 * 2. **POST /master/iqc-items**: 검사항목 생성
 * 3. **PUT /master/iqc-items/:id**: 검사항목 수정
 * 4. **DELETE /master/iqc-items/:id**: 검사항목 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IqcItemService } from '../services/iqc-item.service';
import { CreateIqcItemDto, UpdateIqcItemDto, IqcItemQueryDto } from '../dto/iqc-item.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - IQC검사항목')
@Controller('master/iqc-items')
export class IqcItemController {
  constructor(private readonly iqcItemService: IqcItemService) {}

  @Get()
  @ApiOperation({ summary: 'IQC 검사항목 목록 조회' })
  async findAll(@Query() query: IqcItemQueryDto) {
    const result = await this.iqcItemService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'IQC 검사항목 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.iqcItemService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'IQC 검사항목 생성' })
  async create(@Body() dto: CreateIqcItemDto) {
    const data = await this.iqcItemService.create(dto);
    return ResponseUtil.success(data, 'IQC 검사항목이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'IQC 검사항목 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateIqcItemDto) {
    const data = await this.iqcItemService.update(id, dto);
    return ResponseUtil.success(data, 'IQC 검사항목이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'IQC 검사항목 삭제' })
  async delete(@Param('id') id: string) {
    await this.iqcItemService.delete(id);
    return ResponseUtil.success(null, 'IQC 검사항목이 삭제되었습니다.');
  }
}
