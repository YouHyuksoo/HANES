/**
 * @file src/modules/master/controllers/part.controller.ts
 * @description 품목마스터 CRUD API 컨트롤러
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { PartService } from '../services/part.service';
import { CreatePartDto, UpdatePartDto, PartQueryDto } from '../dto/part.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { PART_TYPE_VALUES } from '@harness/shared';

@ApiTags('기준정보 - 품목마스터')
@Controller('master/parts')
export class PartController {
  constructor(private readonly partService: PartService) {}

  @Get('types/:type')
  @ApiOperation({ summary: '품목 유형별 목록 조회' })
  @ApiParam({ name: 'type', enum: PART_TYPE_VALUES })
  async findByType(@Param('type') type: string) {
    const data = await this.partService.findByType(type);
    return ResponseUtil.success(data);
  }

  @Get('code/:partCode')
  @ApiOperation({ summary: '품목 코드로 조회' })
  async findByCode(@Param('partCode') partCode: string) {
    const data = await this.partService.findByCode(partCode);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '품목 목록 조회' })
  async findAll(@Query() query: PartQueryDto) {
    const result = await this.partService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '품목 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.partService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '품목 생성' })
  async create(@Body() dto: CreatePartDto) {
    const data = await this.partService.create(dto);
    return ResponseUtil.success(data, '품목이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '품목 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdatePartDto) {
    const data = await this.partService.update(id, dto);
    return ResponseUtil.success(data, '품목이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '품목 삭제' })
  async delete(@Param('id') id: string) {
    await this.partService.delete(id);
    return ResponseUtil.success(null, '품목이 삭제되었습니다.');
  }
}
