/**
 * @file src/modules/master/controllers/iqc-part-link.controller.ts
 * @description IQC 품목-거래처-검사그룹 연결 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/iqc-part-links**: 연결 목록 (Part/Partner/Group JOIN)
 * 2. **POST /master/iqc-part-links**: 연결 생성
 * 3. **PUT /master/iqc-part-links/:id**: 연결 수정
 * 4. **DELETE /master/iqc-part-links/:id**: 연결 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { IqcPartLinkService } from '../services/iqc-part-link.service';
import { CreateIqcPartLinkDto, UpdateIqcPartLinkDto, IqcPartLinkQueryDto } from '../dto/iqc-part-link.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - IQC연결관리')
@Controller('master/iqc-part-links')
export class IqcPartLinkController {
  constructor(private readonly iqcPartLinkService: IqcPartLinkService) {}

  @Get()
  @ApiOperation({ summary: 'IQC 연결 목록 조회 (품목/거래처/검사그룹 JOIN)' })
  async findAll(@Query() query: IqcPartLinkQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.iqcPartLinkService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'IQC 연결 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.iqcPartLinkService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'IQC 연결 생성 (품목+거래처 → 검사그룹)' })
  async create(@Body() dto: CreateIqcPartLinkDto) {
    const data = await this.iqcPartLinkService.create(dto);
    return ResponseUtil.success(data, 'IQC 연결이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'IQC 연결 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateIqcPartLinkDto) {
    const data = await this.iqcPartLinkService.update(id, dto);
    return ResponseUtil.success(data, 'IQC 연결이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'IQC 연결 삭제' })
  async delete(@Param('id') id: string) {
    await this.iqcPartLinkService.delete(id);
    return ResponseUtil.success(null, 'IQC 연결이 삭제되었습니다.');
  }
}
