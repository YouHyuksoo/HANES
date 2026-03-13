/**
 * @file spc.controller.ts
 * @description SPC 통계적 공정 관리 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **SPC 관리도 API**: /api/v1/quality/spc-charts
 *    - GET    /spc-charts           : 관리도 목록 조회
 *    - GET    /spc-charts/:id       : 관리도 단건 조회
 *    - POST   /spc-charts           : 관리도 등록
 *    - PUT    /spc-charts/:id       : 관리도 수정
 *    - DELETE /spc-charts/:id       : 관리도 삭제
 *    - POST   /spc-charts/calculate-limits/:id : 관리한계 계산
 *    - GET    /spc-charts/cpk/:id   : Cpk/Ppk 계산
 *    - GET    /spc-charts/chart-data/:id : 차트 데이터 조회
 *
 * 2. **SPC 데이터 API**: /api/v1/quality/spc-data
 *    - POST   /spc-data             : 측정 데이터 입력
 *
 * 3. **인증**: @Company(), @Plant() 데코레이터로 테넌시, req.user.id로 사용자 ID
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { SpcService } from '../services/spc.service';
import {
  CreateSpcChartDto,
  UpdateSpcChartDto,
  CreateSpcDataDto,
  SpcChartFilterDto,
} from '../dto/spc.dto';

@ApiTags('SPC')
@Controller('quality')
export class SpcController {
  constructor(private readonly spcService: SpcService) {}

  // ===== 특수 엔드포인트 (목록 조회보다 먼저 정의) =====

  @Post('spc-charts/calculate-limits/:id')
  @ApiOperation({ summary: '관리한계 계산', description: '기존 데이터에서 UCL/LCL/CL 산출' })
  @ApiParam({ name: 'id', description: '관리도 ID' })
  @ApiResponse({ status: 200, description: '계산 완료' })
  async calculateLimits(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.spcService.calculateControlLimits(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '관리한계가 계산되었습니다.');
  }

  @Get('spc-charts/cpk/:id')
  @ApiOperation({ summary: 'Cpk/Ppk 계산', description: '규격 한계 + 데이터 기반 공정능력 산출' })
  @ApiParam({ name: 'id', description: '관리도 ID' })
  @ApiResponse({ status: 200, description: '계산 완료' })
  async calculateCpk(@Param('id', ParseIntPipe) id: number) {
    const data = await this.spcService.calculateCpk(id);
    return ResponseUtil.success(data);
  }

  @Get('spc-charts/chart-data/:id')
  @ApiOperation({ summary: '차트 데이터 조회', description: '관리도 렌더링용 데이터 포인트' })
  @ApiParam({ name: 'id', description: '관리도 ID' })
  @ApiQuery({ name: 'from', required: false, description: '시작일 (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: '종료일 (ISO 8601)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getChartData(
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Company() company?: string,
    @Plant() plant?: string,
  ) {
    const data = await this.spcService.getChartData(id, from, to, company, plant);
    return ResponseUtil.success(data);
  }

  // ===== 관리도 CRUD =====

  @Get('spc-charts')
  @ApiOperation({ summary: 'SPC 관리도 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllCharts(
    @Query() query: SpcChartFilterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.spcService.findAllCharts(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('spc-charts/:id')
  @ApiOperation({ summary: 'SPC 관리도 단건 조회' })
  @ApiParam({ name: 'id', description: '관리도 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '관리도 없음' })
  async findChartById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.spcService.findChartById(id);
    return ResponseUtil.success(data);
  }

  @Post('spc-charts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'SPC 관리도 등록', description: 'chartNo 자동채번' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async createChart(
    @Body() dto: CreateSpcChartDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.spcService.createChart(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'SPC 관리도가 등록되었습니다.');
  }

  @Put('spc-charts/:id')
  @ApiOperation({ summary: 'SPC 관리도 수정' })
  @ApiParam({ name: 'id', description: '관리도 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateChart(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSpcChartDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.spcService.updateChart(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, 'SPC 관리도가 수정되었습니다.');
  }

  @Delete('spc-charts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SPC 관리도 삭제' })
  @ApiParam({ name: 'id', description: '관리도 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteChart(@Param('id', ParseIntPipe) id: number) {
    await this.spcService.deleteChart(id);
    return ResponseUtil.success(null, 'SPC 관리도가 삭제되었습니다.');
  }

  // ===== 측정 데이터 =====

  @Post('spc-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'SPC 측정 데이터 입력', description: '서브그룹 통계 자동 계산' })
  @ApiResponse({ status: 201, description: '입력 성공' })
  async createData(
    @Body() dto: CreateSpcDataDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.spcService.createData(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '측정 데이터가 입력되었습니다.');
  }
}
