/**
 * @file mold.controller.ts
 * @description 금형관리 API 컨트롤러 — 금형 마스터 CRUD 및 타수/보전 관리
 *
 * 초보자 가이드:
 * 1. **금형관리 API**: /api/v1/equipment/molds
 *    - GET    /molds                   : 금형 목록 조회 (페이지네이션)
 *    - GET    /molds/maintenance-due   : 보전 예정 금형 조회
 *    - GET    /molds/:id               : 금형 단건 조회
 *    - POST   /molds                   : 금형 등록
 *    - PUT    /molds/:id               : 금형 수정
 *    - DELETE /molds/:id               : 금형 삭제 (사용 이력 없는 경우만)
 *    - POST   /molds/:id/usage         : 사용 이력 등록 (타수 누적)
 *    - GET    /molds/:id/usage         : 사용 이력 조회
 *    - PATCH  /molds/:id/retire        : 금형 폐기
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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { MoldService } from '../services/mold.service';
import {
  CreateMoldDto,
  UpdateMoldDto,
  CreateMoldUsageDto,
  MoldQueryDto,
} from '../dto/mold.dto';

@ApiTags('Mold Management')
@Controller('equipment')
export class MoldController {
  constructor(private readonly moldService: MoldService) {}

  // ===== 보전 예정 (목록 조회보다 먼저 정의) =====

  @Get('molds/maintenance-due')
  @ApiOperation({ summary: '보전 예정 금형 조회', description: '보전 주기 도달 또는 보전일 임박 금형' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getMaintenanceDue(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.moldService.getMaintenanceDue(company, plant);
    return ResponseUtil.success(data);
  }

  // ===== CRUD =====

  @Get('molds')
  @ApiOperation({ summary: '금형 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: MoldQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.moldService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('molds/:id')
  @ApiOperation({ summary: '금형 단건 조회' })
  @ApiParam({ name: 'id', description: '금형 코드' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '금형 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.moldService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post('molds')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '금형 등록' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateMoldDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.moldService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '금형이 등록되었습니다.');
  }

  @Put('molds/:id')
  @ApiOperation({ summary: '금형 수정' })
  @ApiParam({ name: 'id', description: '금형 코드' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMoldDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.moldService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '금형이 수정되었습니다.');
  }

  @Delete('molds/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '금형 삭제', description: '사용 이력이 없는 경우만 가능' })
  @ApiParam({ name: 'id', description: '금형 코드' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.moldService.delete(id);
    return ResponseUtil.success(null, '금형이 삭제되었습니다.');
  }

  // ===== 사용 이력 =====

  @Get('molds/:id/usage')
  @ApiOperation({ summary: '사용 이력 조회', description: '금형별 사용 이력' })
  @ApiParam({ name: 'id', description: '금형 코드' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getUsageLogs(@Param('id') id: string) {
    const data = await this.moldService.getUsageLogs(id);
    return ResponseUtil.success(data);
  }

  @Post('molds/:id/usage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '사용 이력 등록', description: '타수 자동 누적' })
  @ApiParam({ name: 'id', description: '금형 코드' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async addUsage(
    @Param('id') id: string,
    @Body() dto: CreateMoldUsageDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.moldService.addUsage(
      id,
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '사용 이력이 등록되었습니다.');
  }

  // ===== 폐기 =====

  @Patch('molds/:id/retire')
  @ApiOperation({ summary: '금형 폐기', description: 'ACTIVE/MAINTENANCE → RETIRED' })
  @ApiParam({ name: 'id', description: '금형 코드' })
  @ApiResponse({ status: 200, description: '폐기 성공' })
  async retire(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.moldService.retire(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '금형이 폐기되었습니다.');
  }
}
