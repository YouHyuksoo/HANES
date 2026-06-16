/**
 * @file iqc-template.controller.ts
 * @description IQC 항목 템플릿 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET    /master/iqc-templates             — 템플릿 목록
 * 2. GET    /master/iqc-templates/:templateId — 템플릿 상세(미리보기)
 * 3. POST   /master/iqc-templates             — 현재 품목 항목을 템플릿으로 저장
 * 4. DELETE /master/iqc-templates/:templateId — 템플릿 삭제
 */
import {
  Controller, Get, Post, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthenticatedRequest, JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { IqcTemplateService } from '../services/iqc-template.service';
import { CreateIqcTemplateDto } from '../dto/iqc-template.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

@ApiTags('기준정보 - IQC 항목 템플릿')
@Controller('master/iqc-templates')
export class IqcTemplateController {
  constructor(private readonly service: IqcTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'IQC 템플릿 목록 조회' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.service.findAll(company, plant, query.page, query.limit);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':templateId')
  @ApiOperation({ summary: 'IQC 템플릿 상세 조회' })
  async findOne(
    @Param('templateId') templateId: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.service.findById(templateId, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '현재 품목 항목을 템플릿으로 저장' })
  async create(
    @Body() dto: CreateIqcTemplateDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id ?? 'SYSTEM';
    const data = await this.service.create(dto, company, plant, userId);
    return ResponseUtil.success(data, '템플릿이 저장되었습니다.');
  }

  @Delete(':templateId')
  @ApiOperation({ summary: 'IQC 템플릿 삭제' })
  async delete(
    @Param('templateId') templateId: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.service.delete(templateId, company, plant);
    return ResponseUtil.success(null, '템플릿이 삭제되었습니다.');
  }
}
