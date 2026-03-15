/**
 * @file training.controller.ts
 * @description 교육훈련 API 컨트롤러 — IATF 16949 7.2 적격성
 *
 * 초보자 가이드:
 * 1. **교육훈련 API**: /api/v1/system/trainings
 *    - GET    /trainings           : 계획 목록 조회 (페이지네이션)
 *    - GET    /trainings/:id       : 계획 단건 조회
 *    - POST   /trainings           : 계획 등록
 *    - PUT    /trainings/:id       : 계획 수정
 *    - DELETE /trainings/:id       : 계획 삭제
 *    - PATCH  /trainings/:id/complete : 완료 처리
 *    - GET    /trainings/:id/results  : 결과 목록
 *    - POST   /trainings/:id/results  : 결과 등록
 *    - GET    /trainings/worker-history/:workerCode : 작업자 교육 이력
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
import { TrainingService } from '../services/training.service';
import {
  CreateTrainingPlanDto,
  UpdateTrainingPlanDto,
  CreateTrainingResultDto,
  TrainingQueryDto,
} from '../dto/training.dto';

@ApiTags('Training')
@Controller('system')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // ===== 작업자 교육 이력 (목록 조회보다 먼저 정의) =====

  @Get('trainings/worker-history/:workerCode')
  @ApiOperation({ summary: '작업자 교육 이력', description: '작업자별 전체 교육 이력 조회' })
  @ApiParam({ name: 'workerCode', description: '작업자 코드' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getWorkerHistory(
    @Param('workerCode') workerCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.trainingService.getWorkerHistory(
      workerCode,
      company,
      plant,
    );
    return ResponseUtil.success(data);
  }

  // ===== CRUD =====

  @Get('trainings')
  @ApiOperation({ summary: '교육 계획 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() query: TrainingQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.trainingService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('trainings/:id')
  @ApiOperation({ summary: '교육 계획 단건 조회' })
  @ApiParam({ name: 'id', description: '교육 계획 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '계획 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.trainingService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post('trainings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '교육 계획 등록', description: 'PLANNED 상태로 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(
    @Body() dto: CreateTrainingPlanDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.trainingService.create(
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '교육 계획이 등록되었습니다.');
  }

  @Put('trainings/:id')
  @ApiOperation({ summary: '교육 계획 수정' })
  @ApiParam({ name: 'id', description: '교육 계획 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.trainingService.update(
      id,
      dto,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '교육 계획이 수정되었습니다.');
  }

  @Delete('trainings/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '교육 계획 삭제', description: 'PLANNED 상태에서만 가능' })
  @ApiParam({ name: 'id', description: '교육 계획 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.trainingService.delete(id);
    return ResponseUtil.success(null, '교육 계획이 삭제되었습니다.');
  }

  // ===== 상태 전이 =====

  @Patch('trainings/:id/complete')
  @ApiOperation({ summary: '교육 완료 처리' })
  @ApiParam({ name: 'id', description: '교육 계획 ID' })
  @ApiResponse({ status: 200, description: '완료 성공' })
  async complete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.trainingService.complete(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '교육이 완료되었습니다.');
  }

  @Patch('trainings/:id/cancel-complete')
  @ApiOperation({ summary: '교육 완료 취소', description: 'COMPLETED → PLANNED' })
  @ApiParam({ name: 'id', description: '교육 계획 ID' })
  @ApiResponse({ status: 200, description: '완료 취소 성공' })
  async cancelComplete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.trainingService.cancelComplete(
      id,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '교육 완료가 취소되었습니다.');
  }

  // ===== 교육 결과 =====

  @Get('trainings/:id/results')
  @ApiOperation({ summary: '교육 결과 목록', description: '계획별 결과 조회' })
  @ApiParam({ name: 'id', description: '교육 계획 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getResults(@Param('id') id: string) {
    const data = await this.trainingService.getResults(id);
    return ResponseUtil.success(data);
  }

  @Post('trainings/:id/results')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '교육 결과 등록' })
  @ApiParam({ name: 'id', description: '교육 계획 ID' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async addResult(
    @Param('id') id: string,
    @Body() dto: CreateTrainingResultDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.trainingService.addResult(
      id,
      dto,
      company,
      plant,
      req.user?.id ?? 'system',
    );
    return ResponseUtil.success(data, '교육 결과가 등록되었습니다.');
  }

  @Patch('trainings/results/:planNo/:workerCode')
  @ApiOperation({ summary: '교육 결과 수정' })
  @ApiParam({ name: 'planNo', description: '교육계획번호' })
  @ApiParam({ name: 'workerCode', description: '작업자코드' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateResult(
    @Param('planNo') planNo: string,
    @Param('workerCode') workerCode: string,
    @Body() dto: CreateTrainingResultDto,
  ) {
    const data = await this.trainingService.updateResult(planNo, workerCode, dto);
    return ResponseUtil.success(data, '교육 결과가 수정되었습니다.');
  }

  @Delete('trainings/results/:planNo/:workerCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '교육 결과 삭제' })
  @ApiParam({ name: 'planNo', description: '교육계획번호' })
  @ApiParam({ name: 'workerCode', description: '작업자코드' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteResult(
    @Param('planNo') planNo: string,
    @Param('workerCode') workerCode: string,
  ) {
    await this.trainingService.deleteResult(planNo, workerCode);
    return ResponseUtil.success(null, '교육 결과가 삭제되었습니다.');
  }
}
