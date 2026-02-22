/**
 * @file src/modules/master/controllers/worker.controller.ts
 * @description 작업자마스터 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/workers**: 작업자 목록 조회 (부서, 검색 필터)
 * 2. **POST /master/workers**: 작업자 생성
 * 3. **PUT /master/workers/:id**: 작업자 수정
 * 4. **DELETE /master/workers/:id**: 작업자 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorkerService } from '../services/worker.service';
import { CreateWorkerDto, UpdateWorkerDto, WorkerQueryDto } from '../dto/worker.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 작업자마스터')
@Controller('master/workers')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Get()
  @ApiOperation({ summary: '작업자 목록 조회' })
  async findAll(@Query() query: WorkerQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.workerService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '작업자 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.workerService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '작업자 생성' })
  async create(@Body() dto: CreateWorkerDto) {
    const data = await this.workerService.create(dto);
    return ResponseUtil.success(data, '작업자가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '작업자 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    const data = await this.workerService.update(id, dto);
    return ResponseUtil.success(data, '작업자가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '작업자 삭제' })
  async delete(@Param('id') id: string) {
    await this.workerService.delete(id);
    return ResponseUtil.success(null, '작업자가 삭제되었습니다.');
  }
}
