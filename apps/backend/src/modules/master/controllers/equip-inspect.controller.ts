/**
 * @file src/modules/master/controllers/equip-inspect.controller.ts
 * @description 설비점검항목마스터 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/equip-inspect-items**: 점검항목 목록 (equipCode, inspectType 필터)
 * 2. **POST /master/equip-inspect-items**: 점검항목 생성
 * 3. **PUT /master/equip-inspect-items/:id**: 점검항목 수정
 * 4. **DELETE /master/equip-inspect-items/:id**: 점검항목 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { EquipInspectService } from '../services/equip-inspect.service';
import { CreateEquipInspectItemDto, UpdateEquipInspectItemDto, EquipInspectItemQueryDto } from '../dto/equip-inspect.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 설비점검항목')
@Controller('master/equip-inspect-items')
export class EquipInspectController {
  constructor(private readonly equipInspectService: EquipInspectService) {}

  @Get()
  @ApiOperation({ summary: '설비점검항목 목록 조회' })
  async findAll(@Query() query: EquipInspectItemQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.equipInspectService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '설비점검항목 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.equipInspectService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설비점검항목 생성' })
  async create(@Body() dto: CreateEquipInspectItemDto) {
    const data = await this.equipInspectService.create(dto);
    return ResponseUtil.success(data, '설비점검항목이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '설비점검항목 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateEquipInspectItemDto) {
    const data = await this.equipInspectService.update(id, dto);
    return ResponseUtil.success(data, '설비점검항목이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '설비점검항목 삭제' })
  async delete(@Param('id') id: string) {
    await this.equipInspectService.delete(id);
    return ResponseUtil.success(null, '설비점검항목이 삭제되었습니다.');
  }
}
