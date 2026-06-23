/**
 * @file src/modules/equipment/controllers/equip-master.controller.ts
 * @description 설비마스터 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **기본 CRUD**: GET, POST, PUT, DELETE 엔드포인트
 * 2. **필터링**: 라인별, 유형별, 상태별 조회
 * 3. **상태 변경**: PATCH /status 엔드포인트
 *
 * API 경로:
 * - GET    /equipment/equips           설비 목록 조회
 * - GET    /equipment/equips/:id       설비 상세 조회
 * - POST   /equipment/equips           설비 생성
 * - PUT    /equipment/equips/:id       설비 수정
 * - DELETE /equipment/equips/:id       설비 삭제
 * - PATCH  /equipment/equips/:id/status 설비 상태 변경
 * - GET    /equipment/equips/line/:lineCode      라인별 설비 조회
 * - GET    /equipment/equips/type/:equipType     유형별 설비 조회
 * - GET    /equipment/equips/status/:status      상태별 설비 조회
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiParam, ApiResponse as SwaggerResponse, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { EquipMasterService } from '../services/equip-master.service';
import {
  CreateEquipMasterDto,
  UpdateEquipMasterDto,
  EquipMasterQueryDto,
  ChangeEquipStatusDto,
  AssignJobOrderDto,
} from '../dto/equip-master.dto';
import { EQUIP_TYPE_VALUES, EQUIP_STATUS_VALUES } from '@harness/shared';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('설비관리 - 설비마스터')
@Controller('equipment/equips')
export class EquipMasterController {
  constructor(private readonly equipMasterService: EquipMasterService) {}

  // =============================================
  // 조회 API
  // =============================================

  @Get('stats')
  @ApiOperation({ summary: '설비 현황 통계' })
  @SwaggerResponse({ status: 200, description: '설비 현황 통계 조회 성공' })
  async getStats(@Company() company: string, @Plant() plant: string) {
    const data = await this.equipMasterService.getEquipmentStats(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('maintenance')
  @ApiOperation({ summary: '정비중/중지 설비 목록 조회' })
  @SwaggerResponse({ status: 200, description: '정비중/중지 설비 목록 조회 성공' })
  async getMaintenanceEquipments(@Company() company: string, @Plant() plant: string) {
    const data = await this.equipMasterService.getMaintenanceEquipments(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('line/:lineCode')
  @ApiOperation({ summary: '라인별 설비 목록 조회' })
  @ApiParam({ name: 'lineCode', description: '라인 코드', example: 'LINE-01' })
  async findByLineCode(
    @Param('lineCode') lineCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.findByLineCode(lineCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('type/:equipType')
  @ApiOperation({ summary: '설비 유형별 목록 조회' })
  @ApiParam({ name: 'equipType', description: '설비 유형', enum: EQUIP_TYPE_VALUES })
  async findByType(
    @Param('equipType') equipType: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.findByType(equipType, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('status/:status')
  @ApiOperation({ summary: '설비 상태별 목록 조회' })
  @ApiParam({ name: 'status', description: '설비 상태', enum: EQUIP_STATUS_VALUES })
  async findByStatus(
    @Param('status') status: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.findByStatus(status, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('code/:equipCode')
  @ApiOperation({ summary: '설비 코드로 조회' })
  @ApiParam({ name: 'equipCode', description: '설비 코드', example: 'EQ-001' })
  async findByCode(
    @Param('equipCode') equipCode: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.findByCode(equipCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '설비 목록 조회' })
  @SwaggerResponse({ status: 200, description: '설비 목록 조회 성공' })
  async findAll(
    @Query() query: EquipMasterQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.equipMasterService.findAll({ ...query, company, plant });
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '설비 상세 조회' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  async findById(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.findById(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          const uploadPath = './uploads/equips';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `equip-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!/^image\/(jpeg|jpg|png|gif|webp)$/.test(file.mimetype)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: '설비 사진 업로드' })
  @ApiConsumes('multipart/form-data')
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const imageUrl = `/uploads/equips/${file.filename}`;
    const data = await this.equipMasterService.updateImage(id, imageUrl, company, plant);
    return ResponseUtil.success(data, '설비 사진이 업로드되었습니다.');
  }

  @Delete(':id/image')
  @ApiOperation({ summary: '설비 사진 삭제' })
  async removeImage(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const existing = await this.equipMasterService.findById(id, company, plant);
    if (existing.imageUrl) {
      const filePath = join('.', existing.imageUrl);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch {
        // 파일 삭제 실패는 DB 경로 해제를 막지 않는다.
      }
    }
    const data = await this.equipMasterService.updateImage(id, null, company, plant);
    return ResponseUtil.success(data, '설비 사진이 삭제되었습니다.');
  }

  // =============================================
  // 생성/수정/삭제 API
  // =============================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설비 생성' })
  @SwaggerResponse({ status: 201, description: '설비 생성 성공' })
  @SwaggerResponse({ status: 409, description: '중복된 설비 코드' })
  async create(
    @Body() dto: CreateEquipMasterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.create(dto, company, plant);
    return ResponseUtil.success(data, '설비가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '설비 수정' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  @SwaggerResponse({ status: 200, description: '설비 수정 성공' })
  @SwaggerResponse({ status: 404, description: '설비를 찾을 수 없음' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipMasterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.update(id, dto, company, plant);
    return ResponseUtil.success(data, '설비가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '설비 삭제' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  @SwaggerResponse({ status: 200, description: '설비 삭제 성공' })
  @SwaggerResponse({ status: 404, description: '설비를 찾을 수 없음' })
  async delete(
    @Param('id') id: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.equipMasterService.delete(id, company, plant);
    return ResponseUtil.success(null, '설비가 삭제되었습니다.');
  }

  // =============================================
  // 상태 변경 API
  // =============================================

  @Patch(':id/status')
  @ApiOperation({ summary: '설비 상태 변경' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  @SwaggerResponse({ status: 200, description: '설비 상태 변경 성공' })
  @SwaggerResponse({ status: 404, description: '설비를 찾을 수 없음' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeEquipStatusDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.changeStatus(id, dto, company, plant);
    return ResponseUtil.success(data, '설비 상태가 변경되었습니다.');
  }

  @Patch(':id/job-order')
  @ApiOperation({ summary: '설비에 작업지시 할당/해제' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  @SwaggerResponse({ status: 200, description: '작업지시 할당/해제 성공' })
  @SwaggerResponse({ status: 404, description: '설비를 찾을 수 없음' })
  async assignJobOrder(
    @Param('id') id: string,
    @Body() dto: AssignJobOrderDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.equipMasterService.assignJobOrder(id, dto, company, plant);
    return ResponseUtil.success(data, dto.orderNo ? '작업지시가 할당되었습니다.' : '작업지시가 해제되었습니다.');
  }

  // =============================================
  // 라인 및 공정 조회 API
  // =============================================

  @Get('metadata/lines')
  @ApiOperation({ summary: '라인 목록 조회 (설비 선택용)' })
  @SwaggerResponse({ status: 200, description: '라인 목록 조회 성공' })
  async getLines(@Company() company: string, @Plant() plant: string) {
    const data = await this.equipMasterService.getLines(company, plant);
    return ResponseUtil.success(data);
  }

  @Get('metadata/processes')
  @ApiOperation({ summary: '공정 목록 조회 (설비 선택용)' })
  @SwaggerResponse({ status: 200, description: '공정 목록 조회 성공' })
  async getProcesses(@Company() company: string, @Plant() plant: string) {
    const data = await this.equipMasterService.getProcesses(company, plant);
    return ResponseUtil.success(data);
  }
}
