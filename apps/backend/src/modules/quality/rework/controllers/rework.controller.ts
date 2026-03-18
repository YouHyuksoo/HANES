/**
 * @file src/modules/quality/rework/controllers/rework.controller.ts
 * @description 재작업 관리 API 컨트롤러 — 재작업 지시 CRUD, 2단계 승인, 재검사
 *
 * 초보자 가이드:
 * 1. **재작업 지시 API**: /api/v1/quality/reworks
 *    - GET    /                     : 목록 조회 (페이지네이션)
 *    - GET    /stats                : 상태별 통계
 *    - GET    /:id                  : 단건 조회
 *    - POST   /                     : 등록
 *    - PUT    /:id                  : 수정
 *    - DELETE /:id                  : 삭제
 *    - PATCH  /:id/request-approval : 품질승인 요청
 *    - PATCH  /:id/qc-approve       : 품질 승인/반려
 *    - PATCH  /:id/prod-approve     : 생산 승인/반려
 *    - PATCH  /:id/start            : 작업 시작
 *    - PATCH  /:id/complete         : 작업 완료
 *
 * 2. **공정별 API**: /api/v1/quality/reworks/processes
 *    - GET    /:id/processes                              : 공정 목록
 *    - PATCH  /processes/:orderId/:processCode/start      : 공정 시작
 *    - PATCH  /processes/:orderId/:processCode/complete   : 공정 완료
 *    - PATCH  /processes/:orderId/:processCode/skip       : 공정 걸�뛰기
 *    - GET    /processes/:orderId/:processCode/results    : 공정별 실적 조회
 *
 * 3. **재검사 API**: /api/v1/quality/reworks/inspects
 *    - GET    /inspects                       : 재검사 목록
 *    - GET    /inspects/:orderId/:seq         : 재검사 단건
 *    - POST   /inspects                       : 재검사 등록
 *
 * 4. **인증**: @Company(), @Plant() 데코레이터로 테넌시 정보, req.user.id로 사용자 ID 추출
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
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { ReworkService } from '../services/rework.service';
import { ReworkProcessService } from '../services/rework-process.service';
import {
  CreateReworkOrderDto,
  UpdateReworkOrderDto,
  ReworkQueryDto,
  ApproveReworkDto,
  CompleteReworkDto,
  CreateReworkInspectDto,
  CreateReworkResultDto,
} from '../dto/rework.dto';

@ApiTags('품질관리 - 재작업')
@Controller('quality/reworks')
export class ReworkController {
  constructor(
    private readonly reworkService: ReworkService,
    private readonly reworkProcessService: ReworkProcessService,
  ) {}

  // ===== 통계 API (목록 조회보다 먼저 정의) =====

  @Get('stats')
  @ApiOperation({ summary: '재작업 통계', description: '상태별 건수 및 수량 합계' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.reworkService.getStats(company, plant);
    return ResponseUtil.success(data);
  }

  // ===== 재작업 지시 CRUD =====

  @Get()
  @ApiOperation({ summary: '재작업 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: ReworkQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.reworkService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '재작업 단건 조회' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '재작업 지시 없음' })
  async findById(@Param('id') reworkNo: string) {
    const data = await this.reworkService.findById(reworkNo);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재작업 등록', description: '재작업 지시 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateReworkOrderDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '재작업이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '재작업 수정' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id') reworkNo: string,
    @Body() dto: UpdateReworkOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkService.update(
      reworkNo,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '재작업이 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '재작업 삭제' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') reworkNo: string) {
    await this.reworkService.delete(reworkNo);
    return ResponseUtil.success(null, '재작업이 삭제되었습니다.');
  }

  // ===== 2단계 승인 =====

  @Patch(':id/request-approval')
  @ApiOperation({ summary: '품질승인 요청', description: 'REGISTERED → QC_PENDING' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  @ApiResponse({ status: 200, description: '승인 요청 성공' })
  async requestApproval(
    @Param('id') reworkNo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkService.requestQcApproval(
      reworkNo,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '승인 요청이 완료되었습니다.');
  }

  @Patch(':id/qc-approve')
  @ApiOperation({ summary: '품질 승인/반려', description: 'QC_PENDING → PROD_PENDING 또는 QC_REJECTED' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async qcApprove(
    @Param('id') reworkNo: string,
    @Body() dto: ApproveReworkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkService.qcApprove(
      reworkNo,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data);
  }

  @Patch(':id/prod-approve')
  @ApiOperation({ summary: '생산 승인/반려', description: 'PROD_PENDING → APPROVED 또는 PROD_REJECTED' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async prodApprove(
    @Param('id') reworkNo: string,
    @Body() dto: ApproveReworkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkService.prodApprove(
      reworkNo,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: '작업 시작', description: 'APPROVED → IN_PROGRESS' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  @ApiResponse({ status: 200, description: '시작 성공' })
  async start(
    @Param('id') reworkNo: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkService.start(
      reworkNo,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '작업이 시작되었습니다.');
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: '작업 완료', description: 'IN_PROGRESS → INSPECT_PENDING' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  @ApiResponse({ status: 200, description: '완료 성공' })
  async complete(
    @Param('id') reworkNo: string,
    @Body() dto: CompleteReworkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkService.complete(
      reworkNo,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '작업이 완료되었습니다.');
  }

  // ===== 공정별 작업 관리 =====

  @Get(':id/processes')
  @ApiOperation({ summary: '공정 목록 조회', description: '재작업 지시의 공정별 작업 목록' })
  @ApiParam({ name: 'id', description: '재작업번호 (REWORK_NO)' })
  async findProcesses(@Param('id') reworkNo: string) {
    const order = await this.reworkService.findById(reworkNo);
    const data = await this.reworkProcessService.findProcesses(order.id);
    return ResponseUtil.success(data);
  }

  @Patch('processes/:orderId/:processCode/start')
  @ApiOperation({ summary: '공정 작업시작', description: 'WAITING → IN_PROGRESS' })
  @ApiParam({ name: 'orderId', description: '재작업 지시 ID (REWORK_ORDER_ID)' })
  @ApiParam({ name: 'processCode', description: '공정 코드 (PROCESS_CODE)' })
  async startProcess(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('processCode') processCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkProcessService.startProcess(orderId, processCode, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '공정 작업이 시작되었습니다.');
  }

  @Patch('processes/:orderId/:processCode/complete')
  @ApiOperation({ summary: '공정 작업완료', description: 'IN_PROGRESS → COMPLETED' })
  @ApiParam({ name: 'orderId', description: '재작업 지시 ID (REWORK_ORDER_ID)' })
  @ApiParam({ name: 'processCode', description: '공정 코드 (PROCESS_CODE)' })
  async completeProcess(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('processCode') processCode: string,
    @Body() body: { resultQty: number },
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkProcessService.completeProcess(orderId, processCode, body.resultQty ?? 0, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '공정 작업이 완료되었습니다.');
  }

  @Patch('processes/:orderId/:processCode/skip')
  @ApiOperation({ summary: '공정 건너뛰기', description: 'WAITING → SKIPPED' })
  @ApiParam({ name: 'orderId', description: '재작업 지시 ID (REWORK_ORDER_ID)' })
  @ApiParam({ name: 'processCode', description: '공정 코드 (PROCESS_CODE)' })
  async skipProcess(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('processCode') processCode: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkProcessService.skipProcess(orderId, processCode, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '공정을 건너뛰었습니다.');
  }

  @Get('processes/:orderId/:processCode/results')
  @ApiOperation({ summary: '공정별 실적 조회' })
  @ApiParam({ name: 'orderId', description: '재작업 지시 ID (REWORK_ORDER_ID)' })
  @ApiParam({ name: 'processCode', description: '공정 코드 (PROCESS_CODE)' })
  async findResults(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('processCode') processCode: string,
  ) {
    const data = await this.reworkProcessService.findResults(orderId, processCode);
    return ResponseUtil.success(data);
  }

  @Post('results')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재작업 실적 등록', description: '공정별 실적 기록' })
  async createResult(
    @Body() dto: CreateReworkResultDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkProcessService.createResult(dto, company, plant, req.user?.id ?? 'system');
    return ResponseUtil.success(data, '실적이 등록되었습니다.');
  }

  // ===== 재작업 후 검사 =====

  @Get('inspects')
  @ApiOperation({ summary: '재검사 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findInspects(
    @Query('reworkOrderId') reworkOrderId: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.reworkService.findInspects(
      reworkOrderId,
      company,
      plant,
    );
    return ResponseUtil.success(data);
  }

  @Get('inspects/:orderId/:seq')
  @ApiOperation({ summary: '재검사 단건 조회' })
  @ApiParam({ name: 'orderId', description: '재작업 지시 ID (REWORK_ORDER_ID)' })
  @ApiParam({ name: 'seq', description: '검사 순번 (SEQ)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '재검사 없음' })
  async findInspectById(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('seq', ParseIntPipe) seq: number,
  ) {
    const data = await this.reworkService.findInspectById(orderId, seq);
    return ResponseUtil.success(data);
  }

  @Post('inspects')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '재검사 결과 등록', description: '재작업 후 재검증 결과 기록' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async createInspect(
    @Body() dto: CreateReworkInspectDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.reworkService.createInspect(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '재검사가 등록되었습니다.');
  }
}
