/**
 * @file document.controller.ts
 * @description 문서관리 API 컨트롤러 — IATF 16949 7.5 문서화된 정보
 *
 * 초보자 가이드:
 * 1. **문서관리 API**: /api/v1/system/documents
 *    - GET    /documents            : 목록 조회 (페이지네이션)
 *    - GET    /documents/expiring   : 만료 예정 문서 조회
 *    - GET    /documents/:id        : 단건 조회
 *    - POST   /documents            : 등록
 *    - PUT    /documents/:id        : 수정
 *    - DELETE /documents/:id        : 삭제 (DRAFT만)
 *    - PATCH  /documents/:id/approve : 승인
 *    - PATCH  /documents/:id/revise  : 개정 (새 DRAFT 생성)
 *
 * 2. **인증**: @Company(), @Plant() 데코레이터로 테넌시 정보
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { DocumentService } from '../services/document.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentQueryDto,
} from '../dto/document.dto';

@ApiTags('Document Control')
@Controller('system')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // ===== 만료 예정 조회 (목록 조회보다 먼저 정의) =====

  @Get('documents/expiring')
  @ApiOperation({ summary: '만료 예정 문서 조회', description: '지정 일수 이내 만료 예정 문서' })
  @ApiQuery({ name: 'days', description: '만료 기한 (일)', type: Number, required: false })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getExpiring(
    @Query('days') days: number = 30,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.documentService.getExpiring(
      Number(days) || 30,
      company,
      plant,
    );
    return ResponseUtil.success(data);
  }

  // ===== CRUD =====

  @Get('documents')
  @ApiOperation({ summary: '문서 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: DocumentQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.documentService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: '문서 단건 조회' })
  @ApiParam({ name: 'id', description: '문서 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '문서 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.documentService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '문서 등록', description: 'DRAFT 상태로 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateDocumentDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.documentService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '문서가 등록되었습니다.');
  }

  @Put('documents/:id')
  @ApiOperation({ summary: '문서 수정' })
  @ApiParam({ name: 'id', description: '문서 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.documentService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '문서가 수정되었습니다.');
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '문서 삭제', description: 'DRAFT 상태에서만 가능' })
  @ApiParam({ name: 'id', description: '문서 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.documentService.delete(id);
    return ResponseUtil.success(null, '문서가 삭제되었습니다.');
  }

  // ===== 상태 전이 =====

  @Patch('documents/:id/approve')
  @ApiOperation({ summary: '문서 승인', description: 'DRAFT/REVIEW → APPROVED' })
  @ApiParam({ name: 'id', description: '문서 ID' })
  @ApiResponse({ status: 200, description: '승인 성공' })
  async approve(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.documentService.approve(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '문서가 승인되었습니다.');
  }

  @Patch('documents/:id/revise')
  @ApiOperation({ summary: '문서 개정', description: 'APPROVED → 새 DRAFT (revisionNo 증가)' })
  @ApiParam({ name: 'id', description: '문서 ID' })
  @ApiResponse({ status: 200, description: '개정 성공' })
  async revise(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.documentService.revise(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '문서가 개정되었습니다.');
  }
}
