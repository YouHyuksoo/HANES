/**
 * @file src/modules/master/controllers/department.controller.ts
 * @description 부서마스터 CRUD API 컨트롤러
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DepartmentService } from '../services/department.service';
import { CreateDepartmentDto, UpdateDepartmentDto, DepartmentQueryDto } from '../dto/department.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('시스템 - 부서관리')
@Controller('system/departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @ApiOperation({ summary: '부서 목록 조회' })
  async findAll(@Query() query: DepartmentQueryDto, @Req() req: Request) {
    const company = req.headers['x-company'] as string | undefined;
    const result = await this.departmentService.findAll(query, company);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '부서 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.departmentService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '부서 생성' })
  async create(@Body() dto: CreateDepartmentDto) {
    const data = await this.departmentService.create(dto);
    return ResponseUtil.success(data, '부서가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '부서 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    const data = await this.departmentService.update(id, dto);
    return ResponseUtil.success(data, '부서가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '부서 삭제' })
  async delete(@Param('id') id: string) {
    await this.departmentService.delete(id);
    return ResponseUtil.success(null, '부서가 삭제되었습니다.');
  }
}
