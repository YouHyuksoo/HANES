/**
 * @file src/modules/master/controllers/company.controller.ts
 * @description 회사마스터 CRUD API 컨트롤러
 *
 * 엔드포인트:
 * - GET  /master/companies         — 목록 (페이지네이션 + 검색, 인증 필요)
 * - GET  /master/companies/public  — 활성 회사 목록 (인증 불필요, 로그인 페이지용)
 * - GET  /master/companies/:id     — 상세 조회
 * - POST /master/companies         — 생성
 * - PUT  /master/companies/:id     — 수정
 * - DELETE /master/companies/:id   — 소프트 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CompanyService } from '../services/company.service';
import { CreateCompanyDto, UpdateCompanyDto, CompanyQueryDto } from '../dto/company.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 회사마스터')
@Controller('master/companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  /** 공개 API — 활성 회사 목록 (로그인 페이지용, 인증 불필요) */
  @Get('public')
  @ApiOperation({ summary: '활성 회사 목록 (인증 불필요)' })
  async findPublic() {
    const data = await this.companyService.findPublic();
    return ResponseUtil.success(data);
  }

  /** 공개 API — 회사별 사업장 목록 (로그인 페이지용, 인증 불필요) */
  @Get('public/plants')
  @ApiOperation({ summary: '회사별 사업장 목록 (인증 불필요)' })
  @ApiQuery({ name: 'company', required: true, description: '회사 코드' })
  async findPlantsByCompany(@Query('company') company: string) {
    const data = await this.companyService.findPlantsByCompany(company);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '회사 목록 조회' })
  async findAll(@Query() query: CompanyQueryDto) {
    const result = await this.companyService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '회사 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.companyService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '회사 생성' })
  async create(@Body() dto: CreateCompanyDto) {
    const data = await this.companyService.create(dto);
    return ResponseUtil.success(data, '회사가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '회사 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    const data = await this.companyService.update(id, dto);
    return ResponseUtil.success(data, '회사가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '회사 삭제' })
  async delete(@Param('id') id: string) {
    await this.companyService.delete(id);
    return ResponseUtil.success(null, '회사가 삭제되었습니다.');
  }
}
