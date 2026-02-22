/**
 * @file src/modules/master/controllers/iqc-item-pool.controller.ts
 * @description IQC 검사항목 풀(Pool) CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET  /master/iqc-item-pool      — 검사항목 풀 목록 조회
 * 2. GET  /master/iqc-item-pool/:id   — 검사항목 상세 조회
 * 3. POST /master/iqc-item-pool       — 검사항목 생성
 * 4. PUT  /master/iqc-item-pool/:id   — 검사항목 수정
 * 5. DELETE /master/iqc-item-pool/:id — 검사항목 삭제
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { IqcItemPoolService } from '../services/iqc-item-pool.service';
import {
  CreateIqcItemPoolDto,
  UpdateIqcItemPoolDto,
  IqcItemPoolQueryDto,
} from '../dto/iqc-item-pool.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - IQC검사항목 풀')
@Controller('master/iqc-item-pool')
export class IqcItemPoolController {
  constructor(private readonly service: IqcItemPoolService) {}

  @Get()
  @ApiOperation({ summary: 'IQC 검사항목 풀 목록 조회' })
  async findAll(@Query() query: IqcItemPoolQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'IQC 검사항목 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'IQC 검사항목 생성' })
  async create(@Body() dto: CreateIqcItemPoolDto) {
    const data = await this.service.create(dto);
    return ResponseUtil.success(data, '검사항목이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'IQC 검사항목 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateIqcItemPoolDto) {
    const data = await this.service.update(id, dto);
    return ResponseUtil.success(data, '검사항목이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'IQC 검사항목 삭제' })
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return ResponseUtil.success(null, '검사항목이 삭제되었습니다.');
  }
}
