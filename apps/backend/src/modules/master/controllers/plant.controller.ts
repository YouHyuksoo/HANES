/**
 * @file src/modules/master/controllers/plant.controller.ts
 * @description 공장/라인 CRUD API 컨트롤러
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PlantService } from '../services/plant.service';
import { CreatePlantDto, UpdatePlantDto, PlantQueryDto, PLANT_TYPES } from '../dto/plant.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 공장/라인')
@Controller('master/plants')
export class PlantController {
  constructor(private readonly plantService: PlantService) {}

  @Get('hierarchy')
  @ApiOperation({ summary: '계층 트리 조회' })
  async findHierarchy(@Query('rootId') rootId?: string) {
    const data = await this.plantService.findHierarchy(rootId);
    return ResponseUtil.success(data);
  }

  @Get('types/:type')
  @ApiOperation({ summary: '타입별 목록 조회' })
  @ApiParam({ name: 'type', enum: PLANT_TYPES })
  async findByType(@Param('type') type: string) {
    const data = await this.plantService.findByType(type);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '목록 조회' })
  async findAll(@Query() query: PlantQueryDto) {
    const result = await this.plantService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.plantService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '생성' })
  async create(@Body() dto: CreatePlantDto) {
    const data = await this.plantService.create(dto);
    return ResponseUtil.success(data, '공장/라인이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '수정' })
  async update(@Param('id') id: string, @Body() dto: UpdatePlantDto) {
    const data = await this.plantService.update(id, dto);
    return ResponseUtil.success(data, '공장/라인이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '삭제' })
  async delete(@Param('id') id: string) {
    await this.plantService.delete(id);
    return ResponseUtil.success(null, '공장/라인이 삭제되었습니다.');
  }
}
