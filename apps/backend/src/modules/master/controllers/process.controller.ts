/**
 * @file src/modules/master/controllers/process.controller.ts
 * @description 공정마스터 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/processes**: 공정 목록 조회 (페이징, 검색)
 * 2. **POST /master/processes**: 공정 생성
 * 3. **PUT /master/processes/:id**: 공정 수정
 * 4. **DELETE /master/processes/:id**: 공정 삭제 (소프트)
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ProcessService } from '../services/process.service';
import { CreateProcessDto, UpdateProcessDto, ProcessQueryDto } from '../dto/process.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 공정마스터')
@Controller('master/processes')
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  @Get()
  @ApiOperation({ summary: '공정 목록 조회' })
  async findAll(@Query() query: ProcessQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.processService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '공정 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.processService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '공정 생성' })
  async create(@Body() dto: CreateProcessDto) {
    const data = await this.processService.create(dto);
    return ResponseUtil.success(data, '공정이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '공정 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateProcessDto) {
    const data = await this.processService.update(id, dto);
    return ResponseUtil.success(data, '공정이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '공정 삭제' })
  async delete(@Param('id') id: string) {
    await this.processService.delete(id);
    return ResponseUtil.success(null, '공정이 삭제되었습니다.');
  }
}
