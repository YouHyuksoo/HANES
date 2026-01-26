/**
 * @file src/modules/material/controllers/mat-issue.controller.ts
 * @description 자재출고 API 컨트롤러
 */

import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MatIssueService } from '../services/mat-issue.service';
import { CreateMatIssueDto, MatIssueQueryDto } from '../dto/mat-issue.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - 출고')
@Controller('material/issues')
export class MatIssueController {
  constructor(private readonly matIssueService: MatIssueService) {}

  @Get()
  @ApiOperation({ summary: '출고 이력 조회' })
  async findAll(@Query() query: MatIssueQueryDto) {
    const result = await this.matIssueService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '출고 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.matIssueService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '자재 출고' })
  async create(@Body() dto: CreateMatIssueDto) {
    const data = await this.matIssueService.create(dto);
    return ResponseUtil.success(data, '자재가 출고되었습니다.');
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '출고 취소' })
  async cancel(@Param('id') id: string, @Body('reason') reason?: string) {
    const data = await this.matIssueService.cancel(id, reason);
    return ResponseUtil.success(data, '출고가 취소되었습니다.');
  }
}
