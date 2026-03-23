/**
 * @file complaint.controller.ts
 * @description 고객클레임 API 컨트롤러 — IATF 16949 10.2.6 고객 불만 관리
 *
 * 초보자 가이드:
 * 1. **클레임 API**: @Controller('quality/complaints')
 *    - GET    /quality/complaints              : 목록 조회 (페이지네이션)
 *    - GET    /quality/complaints/stats        : 상태별 통계
 *    - GET    /quality/complaints/:id          : 단건 조회
 *    - POST   /quality/complaints              : 등록
 *    - PUT    /quality/complaints/:id          : 수정
 *    - DELETE /quality/complaints/:id          : 삭제
 *    - PATCH  /quality/complaints/:id/investigate : 조사 시작
 *    - PATCH  /quality/complaints/:id/respond     : 대응 완료
 *    - PATCH  /quality/complaints/:id/resolve     : 해결
 *    - PATCH  /quality/complaints/:id/close       : 종료
 *    - PATCH  /quality/complaints/:id/link-capa   : CAPA 연계
 *
 * 2. **인증**: @Company(), @Plant() 데코레이터로 테넌시 정보, req.user.id로 사용자 ID 추출
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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { JwtAuthGuard, AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { ComplaintService } from '../services/complaint.service';
import {
  CreateComplaintDto,
  UpdateComplaintDto,
  ComplaintQueryDto,
  InvestigateComplaintDto,
  RespondComplaintDto,
  LinkCapaDto,
} from '../dto/complaint.dto';

@ApiTags('품질관리 - 고객클레임')
@UseGuards(JwtAuthGuard)
@Controller('quality/complaints')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  // ===== 통계 API (목록 조회보다 먼저 정의) =====

  @Get('stats')
  @ApiOperation({ summary: '클레임 통계', description: '상태별 건수 및 불량수량 합계' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.complaintService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  // ===== CRUD =====

  @Get()
  @ApiOperation({ summary: '클레임 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: ComplaintQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.complaintService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '클레임 단건 조회' })
  @ApiParam({ name: 'id', description: '클레임 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '클레임 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.complaintService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '클레임 등록', description: '고객클레임 접수' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateComplaintDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.complaintService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '고객클레임이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '클레임 수정' })
  @ApiParam({ name: 'id', description: '클레임 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.complaintService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '고객클레임이 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '클레임 삭제' })
  @ApiParam({ name: 'id', description: '클레임 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.complaintService.delete(id);
    return ResponseUtil.success(null, '고객클레임이 삭제되었습니다.');
  }

  // ===== 상태 전환 =====

  @Patch(':id/investigate')
  @ApiOperation({ summary: '조사 시작', description: 'RECEIVED → INVESTIGATING' })
  @ApiParam({ name: 'id', description: '클레임 ID' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async investigate(
    @Param('id') id: string,
    @Body() dto: InvestigateComplaintDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.complaintService.investigate(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '조사가 시작되었습니다.');
  }

  @Patch(':id/respond')
  @ApiOperation({ summary: '대응 완료', description: 'INVESTIGATING → RESPONDING' })
  @ApiParam({ name: 'id', description: '클레임 ID' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondComplaintDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.complaintService.respond(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '대응이 완료되었습니다.');
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: '해결', description: 'RESPONDING → RESOLVED' })
  @ApiParam({ name: 'id', description: '클레임 ID' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async resolve(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.complaintService.resolve(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '클레임이 해결되었습니다.');
  }

  @Patch(':id/close')
  @ApiOperation({ summary: '종료', description: 'RESOLVED → CLOSED' })
  @ApiParam({ name: 'id', description: '클레임 ID' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async close(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.complaintService.close(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '클레임이 종료되었습니다.');
  }

  @Patch(':id/link-capa')
  @ApiOperation({ summary: 'CAPA 연계', description: '클레임에 CAPA ID 연결' })
  @ApiParam({ name: 'id', description: '클레임 ID' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async linkCapa(
    @Param('id') id: string,
    @Body() dto: LinkCapaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.complaintService.linkCapa(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'CAPA가 연계되었습니다.');
  }
}
