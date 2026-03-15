/**
 * @file src/modules/master/controllers/equip-inspect.controller.ts
 * @description 설비점검항목마스터 CRUD API 컨트롤러
 *              복합키: equipCode + inspectType + seq (tenant: company + plant)
 *
 * 초보자 가이드:
 * 1. GET  /master/equip-inspect-items          — 목록 조회
 * 2. POST /master/equip-inspect-items          — 생성
 * 3. PUT  /master/equip-inspect-items/:equipCode/:inspectType/:seq — 수정
 * 4. DELETE /master/equip-inspect-items/:equipCode/:inspectType/:seq — 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { EquipInspectService } from '../services/equip-inspect.service';
import { CreateEquipInspectItemDto, UpdateEquipInspectItemDto, EquipInspectItemQueryDto } from '../dto/equip-inspect.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 설비점검항목')
@Controller('master/equip-inspect-items')
export class EquipInspectController {
  constructor(private readonly equipInspectService: EquipInspectService) {}

  @Get()
  @ApiOperation({ summary: '설비점검항목 목록 조회' })
  async findAll(@Query() query: EquipInspectItemQueryDto, @Req() req: Request) {
    const company = (req.headers['x-company'] as string) || '';
    const plant = (req.headers['x-plant'] as string) || '';
    const result = await this.equipInspectService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설비점검항목 생성' })
  async create(@Body() dto: CreateEquipInspectItemDto, @Req() req: Request) {
    const company = (req.headers['x-company'] as string) || '';
    const plant = (req.headers['x-plant'] as string) || '';
    const data = await this.equipInspectService.create(dto, company, plant);
    return ResponseUtil.success(data, '설비점검항목이 생성되었습니다.');
  }

  @Put(':equipCode/:inspectType/:seq')
  @ApiOperation({ summary: '설비점검항목 수정' })
  async update(
    @Param('equipCode') equipCode: string,
    @Param('inspectType') inspectType: string,
    @Param('seq') seq: string,
    @Body() dto: UpdateEquipInspectItemDto,
    @Req() req: Request,
  ) {
    const company = (req.headers['x-company'] as string) || '';
    const plant = (req.headers['x-plant'] as string) || '';
    const data = await this.equipInspectService.update(company, plant, equipCode, inspectType, +seq, dto);
    return ResponseUtil.success(data, '설비점검항목이 수정되었습니다.');
  }

  @Delete(':equipCode/:inspectType/:seq')
  @ApiOperation({ summary: '설비점검항목 삭제' })
  async delete(
    @Param('equipCode') equipCode: string,
    @Param('inspectType') inspectType: string,
    @Param('seq') seq: string,
    @Req() req: Request,
  ) {
    const company = (req.headers['x-company'] as string) || '';
    const plant = (req.headers['x-plant'] as string) || '';
    await this.equipInspectService.delete(company, plant, equipCode, inspectType, +seq);
    return ResponseUtil.success(null, '설비점검항목이 삭제되었습니다.');
  }
}
