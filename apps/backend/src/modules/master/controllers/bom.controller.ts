/**
 * @file src/modules/master/controllers/bom.controller.ts
 * @description BOM CRUD API 컨트롤러 - Oracle TM_BOM 기준 보강
 *
 * 초보자 가이드:
 * 1. **GET /parents**: BOM에 등재된 모품목(부모품목) 목록 + 자품목 수
 * 2. **GET /hierarchy/:parentItemCode**: 부모품목 기준 트리 구조 조회
 * 3. **CRUD**: 추가/수정/삭제 모두 DB에 반영
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BomService } from '../services/bom.service';
import { CreateBomDto, UpdateBomDto, BomQueryDto } from '../dto/bom.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - BOM')
@Controller('master/boms')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Get('parents')
  @ApiOperation({ summary: 'BOM 모품목(부모품목) 목록 조회' })
  @ApiQuery({ name: 'search', required: false, description: '검색어' })
  @ApiQuery({ name: 'effectiveDate', required: false, description: '유효일자 (YYYY-MM-DD)' })
  async findParents(
    @Query('search') search?: string,
    @Query('effectiveDate') effectiveDate?: string,
  ) {
    const data = await this.bomService.findParents(search, effectiveDate);
    return ResponseUtil.success(data);
  }

  @Get('hierarchy/:parentItemCode')
  @ApiOperation({ summary: 'BOM 계층 조회' })
  @ApiParam({ name: 'parentItemCode', description: '상위 품목 ID' })
  @ApiQuery({ name: 'depth', required: false, description: '조회 깊이 (기본 3)' })
  @ApiQuery({ name: 'effectiveDate', required: false, description: '유효일자 (YYYY-MM-DD)' })
  async findHierarchy(
    @Param('parentItemCode') parentItemCode: string,
    @Query('depth') depth?: number,
    @Query('effectiveDate') effectiveDate?: string,
  ) {
    const data = await this.bomService.findHierarchy(parentItemCode, depth ?? 3, effectiveDate);
    return ResponseUtil.success(data);
  }

  @Get('parent/:parentItemCode')
  @ApiOperation({ summary: '상위 품목 기준 BOM 조회' })
  @ApiQuery({ name: 'effectiveDate', required: false, description: '유효일자 (YYYY-MM-DD)' })
  async findByParentId(
    @Param('parentItemCode') parentItemCode: string,
    @Query('effectiveDate') effectiveDate?: string,
  ) {
    const data = await this.bomService.findByParentId(parentItemCode, effectiveDate);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: 'BOM 목록 조회' })
  async findAll(@Query() query: BomQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.bomService.findAll(query, company, plant);
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
