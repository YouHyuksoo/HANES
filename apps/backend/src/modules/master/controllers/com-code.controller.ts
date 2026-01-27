/**
 * @file src/modules/master/controllers/com-code.controller.ts
 * @description 공통코드 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/master/com-codes
 * 2. **Swagger**: @ApiTags, @ApiOperation 등으로 문서화
 * 3. **인증**: 필요시 @UseGuards(JwtAuthGuard) 적용
 *
 * API 구조:
 * - GET  /groups              : 그룹 코드 목록 (중복 제거)
 * - GET  /groups/:groupCode   : 그룹 코드로 상세 코드 목록 조회
 * - GET  /                    : 공통코드 목록 (페이지네이션)
 * - GET  /:id                 : 공통코드 단건 조회
 * - POST /                    : 공통코드 생성
 * - PUT  /:id                 : 공통코드 수정
 * - DELETE /:id               : 공통코드 삭제
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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ComCodeService } from '../services/com-code.service';
import {
  CreateComCodeDto,
  UpdateComCodeDto,
  ComCodeQueryDto,
} from '../dto/com-code.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 공통코드')
@Controller('master/com-codes')
export class ComCodeController {
  constructor(private readonly comCodeService: ComCodeService) {}

  // ===== 전체 활성 코드 일괄 조회 =====

  @Get('all-active')
  @ApiOperation({ summary: '전체 활성 공통코드 일괄 조회', description: 'groupCode별 그룹핑된 전체 활성 코드 반환 (프론트엔드 초기 로딩용)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllActive() {
    const data = await this.comCodeService.findAllActive();
    return ResponseUtil.success(data);
  }

  // ===== 그룹 코드 =====

  @Get('groups')
  @ApiOperation({ summary: '공통코드 그룹 목록 조회', description: '중복 제거된 그룹 코드 목록과 각 그룹의 코드 개수' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllGroups() {
    const data = await this.comCodeService.findAllGroups();
    return ResponseUtil.success(data);
  }

  @Get('groups/:groupCode')
  @ApiOperation({ summary: '그룹 코드로 상세 코드 목록 조회', description: '해당 그룹의 활성화된 상세 코드 목록' })
  @ApiParam({ name: 'groupCode', description: '그룹 코드', example: 'PRODUCT_TYPE' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findByGroupCode(@Param('groupCode') groupCode: string) {
    const data = await this.comCodeService.findByGroupCode(groupCode);
    return ResponseUtil.success(data);
  }

  // ===== 공통코드 CRUD =====

  @Get()
  @ApiOperation({ summary: '공통코드 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ComCodeQueryDto) {
    const result = await this.comCodeService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '공통코드 상세 조회' })
  @ApiParam({ name: 'id', description: '코드 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '코드 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.comCodeService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '공통코드 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 409, description: '중복 코드' })
  async create(@Body() dto: CreateComCodeDto) {
    const data = await this.comCodeService.create(dto);
    return ResponseUtil.success(data, '공통코드가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '공통코드 수정' })
  @ApiParam({ name: 'id', description: '코드 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '코드 없음' })
  async update(@Param('id') id: string, @Body() dto: UpdateComCodeDto) {
    const data = await this.comCodeService.update(id, dto);
    return ResponseUtil.success(data, '공통코드가 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '공통코드 삭제' })
  @ApiParam({ name: 'id', description: '코드 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '코드 없음' })
  async delete(@Param('id') id: string) {
    await this.comCodeService.delete(id);
    return ResponseUtil.success(null, '공통코드가 삭제되었습니다.');
  }

  @Delete('groups/:groupCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '그룹 코드로 공통코드 일괄 삭제' })
  @ApiParam({ name: 'groupCode', description: '그룹 코드' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteByGroupCode(@Param('groupCode') groupCode: string) {
    const result = await this.comCodeService.deleteByGroupCode(groupCode);
    return ResponseUtil.success(result, `${result.count}개의 공통코드가 삭제되었습니다.`);
  }
}
