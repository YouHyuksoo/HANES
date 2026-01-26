/**
 * @file src/modules/master/controllers/bom.controller.ts
 * @description BOM CRUD API 컨트롤러
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BomService } from '../services/bom.service';
import { CreateBomDto, UpdateBomDto, BomQueryDto } from '../dto/bom.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - BOM')
@Controller('master/boms')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Get('hierarchy/:parentPartId')
  @ApiOperation({ summary: 'BOM 계층 조회' })
  @ApiParam({ name: 'parentPartId', description: '상위 품목 ID' })
  @ApiQuery({ name: 'depth', required: false, description: '조회 깊이 (기본 3)' })
  async findHierarchy(@Param('parentPartId') parentPartId: string, @Query('depth') depth?: number) {
    const data = await this.bomService.findHierarchy(parentPartId, depth ?? 3);
    return ResponseUtil.success(data);
  }

  @Get('parent/:parentPartId')
  @ApiOperation({ summary: '상위 품목 기준 BOM 조회' })
  async findByParentId(@Param('parentPartId') parentPartId: string) {
    const data = await this.bomService.findByParentId(parentPartId);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: 'BOM 목록 조회' })
  async findAll(@Query() query: BomQueryDto) {
    const result = await this.bomService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'BOM 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.bomService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'BOM 생성' })
  async create(@Body() dto: CreateBomDto) {
    const data = await this.bomService.create(dto);
    return ResponseUtil.success(data, 'BOM이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'BOM 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateBomDto) {
    const data = await this.bomService.update(id, dto);
    return ResponseUtil.success(data, 'BOM이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'BOM 삭제' })
  async delete(@Param('id') id: string) {
    await this.bomService.delete(id);
    return ResponseUtil.success(null, 'BOM이 삭제되었습니다.');
  }
}
