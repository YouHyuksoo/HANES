/**
 * @file src/modules/master/controllers/model-suffix.controller.ts
 * @description 모델접미사 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/model-suffixes**: 접미사 목록 (modelCode, customer 필터)
 * 2. **POST /master/model-suffixes**: 접미사 생성
 * 3. **PUT /master/model-suffixes/:id**: 접미사 수정
 * 4. **DELETE /master/model-suffixes/:id**: 접미사 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ModelSuffixService } from '../services/model-suffix.service';
import { CreateModelSuffixDto, UpdateModelSuffixDto, ModelSuffixQueryDto } from '../dto/model-suffix.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 모델접미사')
@Controller('master/model-suffixes')
export class ModelSuffixController {
  constructor(private readonly modelSuffixService: ModelSuffixService) {}

  @Get()
  @ApiOperation({ summary: '모델접미사 목록 조회' })
  async findAll(@Query() query: ModelSuffixQueryDto) {
    const result = await this.modelSuffixService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '모델접미사 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.modelSuffixService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '모델접미사 생성' })
  async create(@Body() dto: CreateModelSuffixDto) {
    const data = await this.modelSuffixService.create(dto);
    return ResponseUtil.success(data, '모델접미사가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '모델접미사 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateModelSuffixDto) {
    const data = await this.modelSuffixService.update(id, dto);
    return ResponseUtil.success(data, '모델접미사가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '모델접미사 삭제' })
  async delete(@Param('id') id: string) {
    await this.modelSuffixService.delete(id);
    return ResponseUtil.success(null, '모델접미사가 삭제되었습니다.');
  }
}
