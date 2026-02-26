/**
 * @file src/modules/master/controllers/iqc-group.controller.ts
 * @description IQC 검사그룹 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/iqc-groups**: 검사그룹 목록 조회 (검색, 검사형태 필터)
 * 2. **GET /master/iqc-groups/:id**: 검사그룹 상세 (항목 포함)
 * 3. **POST /master/iqc-groups**: 검사그룹 생성 (항목 매핑 포함)
 * 4. **PUT /master/iqc-groups/:id**: 검사그룹 수정 (항목 매핑 포함)
 * 5. **DELETE /master/iqc-groups/:id**: 검사그룹 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { IqcGroupService } from '../services/iqc-group.service';
import { CreateIqcGroupDto, UpdateIqcGroupDto, IqcGroupQueryDto } from '../dto/iqc-group.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - IQC검사그룹')
@Controller('master/iqc-groups')
export class IqcGroupController {
  constructor(private readonly iqcGroupService: IqcGroupService) {}

  @Get()
  @ApiOperation({ summary: 'IQC 검사그룹 목록 조회' })
  async findAll(@Query() query: IqcGroupQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.iqcGroupService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'IQC 검사그룹 상세 조회 (항목 포함)' })
  async findById(@Param('id') id: string) {
    const data = await this.iqcGroupService.findById(+id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'IQC 검사그룹 생성' })
  async create(@Body() dto: CreateIqcGroupDto) {
    const data = await this.iqcGroupService.create(dto);
    return ResponseUtil.success(data, 'IQC 검사그룹이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'IQC 검사그룹 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateIqcGroupDto) {
    const data = await this.iqcGroupService.update(+id, dto);
    return ResponseUtil.success(data, 'IQC 검사그룹이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'IQC 검사그룹 삭제' })
  async delete(@Param('id') id: string) {
    await this.iqcGroupService.delete(+id);
    return ResponseUtil.success(null, 'IQC 검사그룹이 삭제되었습니다.');
  }
}
