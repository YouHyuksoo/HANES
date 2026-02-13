/**
 * @file src/modules/master/controllers/work-instruction.controller.ts
 * @description 작업지도서 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/work-instructions**: 작업지도서 목록 (partId, processCode 필터)
 * 2. **POST /master/work-instructions**: 작업지도서 생성
 * 3. **PUT /master/work-instructions/:id**: 작업지도서 수정
 * 4. **DELETE /master/work-instructions/:id**: 작업지도서 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorkInstructionService } from '../services/work-instruction.service';
import { CreateWorkInstructionDto, UpdateWorkInstructionDto, WorkInstructionQueryDto } from '../dto/work-instruction.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 작업지도서')
@Controller('master/work-instructions')
export class WorkInstructionController {
  constructor(private readonly workInstructionService: WorkInstructionService) {}

  @Get()
  @ApiOperation({ summary: '작업지도서 목록 조회' })
  async findAll(@Query() query: WorkInstructionQueryDto) {
    const result = await this.workInstructionService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '작업지도서 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.workInstructionService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '작업지도서 생성' })
  async create(@Body() dto: CreateWorkInstructionDto) {
    const data = await this.workInstructionService.create(dto);
    return ResponseUtil.success(data, '작업지도서가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '작업지도서 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateWorkInstructionDto) {
    const data = await this.workInstructionService.update(id, dto);
    return ResponseUtil.success(data, '작업지도서가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '작업지도서 삭제' })
  async delete(@Param('id') id: string) {
    await this.workInstructionService.delete(id);
    return ResponseUtil.success(null, '작업지도서가 삭제되었습니다.');
  }
}
