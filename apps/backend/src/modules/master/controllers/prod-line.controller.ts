/**
 * @file src/modules/master/controllers/prod-line.controller.ts
 * @description 생산라인마스터 CRUD API 컨트롤러
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProdLineService } from '../services/prod-line.service';
import { CreateProdLineDto, UpdateProdLineDto, ProdLineQueryDto } from '../dto/prod-line.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 생산라인마스터')
@Controller('master/prod-lines')
export class ProdLineController {
  constructor(private readonly prodLineService: ProdLineService) {}

  @Get()
  @ApiOperation({ summary: '생산라인 목록 조회' })
  async findAll(@Query() query: ProdLineQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.prodLineService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '생산라인 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.prodLineService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '생산라인 생성' })
  async create(@Body() dto: CreateProdLineDto) {
    const data = await this.prodLineService.create(dto);
    return ResponseUtil.success(data, '생산라인이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '생산라인 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateProdLineDto) {
    const data = await this.prodLineService.update(id, dto);
    return ResponseUtil.success(data, '생산라인이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '생산라인 삭제' })
  async delete(@Param('id') id: string) {
    await this.prodLineService.delete(id);
    return ResponseUtil.success(null, '생산라인이 삭제되었습니다.');
  }
}
