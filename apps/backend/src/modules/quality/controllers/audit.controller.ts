/**
 * @file audit.controller.ts
 * @description 내부심사 API 컨트롤러 — IATF 16949 9.2
 *
 * 초보자 가이드:
 * 1. **내부심사 API**: /api/v1/quality/audits
 *    - GET    /audits              : 심사 목록 조회 (페이지네이션)
 *    - GET    /audits/:id          : 심사 단건 조회
 *    - POST   /audits              : 심사 계획 등록
 *    - PUT    /audits/:id          : 심사 계획 수정
 *    - DELETE /audits/:id          : 심사 계획 삭제 (PLANNED만)
 *    - PATCH  /audits/:id/complete : 심사 완료
 *    - PATCH  /audits/:id/close    : 심사 종결
 *    - GET    /audits/:id/findings : 발견사항 목록
 *    - POST   /audit-findings      : 발견사항 등록
 *    - PATCH  /audit-findings/:id/link-capa : CAPA 연결
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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { AuditService } from '../services/audit.service';
import {
  CreateAuditPlanDto,
  UpdateAuditPlanDto,
  CreateAuditFindingDto,
  AuditQueryDto,
} from '../dto/audit.dto';

@ApiTags('Internal Audit')
@Controller('quality')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ===== CRUD =====

  @Get('audits')
  @ApiOperation({ summary: '심사 계획 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: AuditQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.auditService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('audits/:id')
  @ApiOperation({ summary: '심사 계획 단건 조회' })
  @ApiParam({ name: 'id', description: '심사 계획 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '심사 계획 없음' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.auditService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post('audits')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '심사 계획 등록', description: 'PLANNED 상태로 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateAuditPlanDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.auditService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '심사 계획이 등록되었습니다.');
  }

  @Put('audits/:id')
  @ApiOperation({ summary: '심사 계획 수정' })
  @ApiParam({ name: 'id', description: '심사 계획 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAuditPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.auditService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '심사 계획이 수정되었습니다.');
  }

  @Delete('audits/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '심사 계획 삭제', description: 'PLANNED 상태에서만 가능' })
  @ApiParam({ name: 'id', description: '심사 계획 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.auditService.delete(id);
    return ResponseUtil.success(null, '심사 계획이 삭제되었습니다.');
  }

  // ===== 상태 전이 =====

  @Patch('audits/:id/complete')
  @ApiOperation({ summary: '심사 완료', description: 'IN_PROGRESS → COMPLETED' })
  @ApiParam({ name: 'id', description: '심사 계획 ID' })
  @ApiResponse({ status: 200, description: '완료 성공' })
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @Body('overallResult') overallResult: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.auditService.complete(
      id,
      overallResult,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '심사가 완료되었습니다.');
  }

  @Patch('audits/:id/close')
  @ApiOperation({ summary: '심사 종결', description: 'COMPLETED → CLOSED' })
  @ApiParam({ name: 'id', description: '심사 계획 ID' })
  @ApiResponse({ status: 200, description: '종결 성공' })
  async close(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.auditService.close(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '심사가 종결되었습니다.');
  }

  // ===== 발견사항 =====

  @Get('audits/:id/findings')
  @ApiOperation({ summary: '발견사항 목록', description: '심사별 발견사항 조회' })
  @ApiParam({ name: 'id', description: '심사 계획 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getFindings(@Param('id', ParseIntPipe) id: number) {
    const data = await this.auditService.getFindings(id);
    return ResponseUtil.success(data);
  }

  @Post('audit-findings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '발견사항 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async addFinding(
    @Body() dto: CreateAuditFindingDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.auditService.addFinding(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '발견사항이 등록되었습니다.');
  }

  @Patch('audit-findings/:id/link-capa')
  @ApiOperation({ summary: 'CAPA 연결', description: '발견사항에 CAPA 연결' })
  @ApiParam({ name: 'id', description: '발견사항 ID' })
  @ApiResponse({ status: 200, description: '연결 성공' })
  async linkCapa(
    @Param('id', ParseIntPipe) id: number,
    @Body('capaId') capaId: number,
  ) {
    const data = await this.auditService.linkCapa(id, capaId);
    return ResponseUtil.success(data, 'CAPA가 연결되었습니다.');
  }
}
