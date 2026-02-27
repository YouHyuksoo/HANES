/**
 * @file src/modules/equipment/controllers/consumable.controller.ts
 * @description 소모품(금형/지그/공구) CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **기본 CRUD**: 소모품 마스터 관리
 * 2. **수명 관리**: 사용 횟수 증가, 교체 등록
 * 3. **이력 관리**: 입출고 및 상태 변경 로그
 *
 * API 경로:
 * - GET    /equipment/consumables                    소모품 목록 조회
 * - GET    /equipment/consumables/:id                소모품 상세 조회
 * - POST   /equipment/consumables                    소모품 생성
 * - PUT    /equipment/consumables/:id                소모품 수정
 * - DELETE /equipment/consumables/:id                소모품 삭제
 * - POST   /equipment/consumables/:id/increase       사용 횟수 증가
 * - POST   /equipment/consumables/:id/replace        교체 등록
 * - GET    /equipment/consumables/category/:category 카테고리별 조회
 * - GET    /equipment/consumables/warnings           경고 상태 목록
 * - GET    /equipment/consumables/schedule           교체 예정 목록
 *
 * 소모품 로그:
 * - GET    /equipment/consumable-logs                로그 목록 조회
 * - POST   /equipment/consumable-logs                로그 생성
 * - GET    /equipment/consumable-logs/consumable/:id 특정 소모품 로그
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiConsumes, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { ConsumableService } from '../services/consumable.service';
import {
  EquipCreateConsumableDto,
  EquipUpdateConsumableDto,
  ConsumableQueryDto,
  EquipCreateConsumableLogDto,
  ConsumableLogQueryDto,
  IncreaseCountDto,
  RegisterReplacementDto,
  MountToEquipDto,
  UnmountFromEquipDto,
  SetRepairDto,
  PmCalendarQueryDto,
  PmDayScheduleQueryDto,
} from '../dto/consumable.dto';
import { CONSUMABLE_CATEGORY_VALUES } from '@harness/shared';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('설비관리 - 소모품(금형/지그/공구)')
@Controller('equipment/consumables')
export class ConsumableController {
  constructor(private readonly consumableService: ConsumableService) {}

  // =============================================
  // 통계 및 현황 조회
  // =============================================

  @Get('stats')
  @ApiOperation({ summary: '소모품 현황 통계' })
  @SwaggerResponse({ status: 200, description: '소모품 현황 통계 조회 성공' })
  async getStats() {
    const data = await this.consumableService.getConsumableStats();
    return ResponseUtil.success(data);
  }

  @Get('warnings')
  @ApiOperation({ summary: '경고/교체필요 상태 소모품 목록 조회' })
  @SwaggerResponse({ status: 200, description: '경고 상태 소모품 목록 조회 성공' })
  async getWarningConsumables() {
    const data = await this.consumableService.findWarningConsumables();
    return ResponseUtil.success(data);
  }

  @Get('schedule')
  @ApiOperation({ summary: '교체 예정 목록 조회' })
  @ApiQuery({ name: 'days', required: false, description: '조회 기간 (일)', example: 30 })
  @SwaggerResponse({ status: 200, description: '교체 예정 목록 조회 성공' })
  async getReplacementSchedule(@Query('days') days?: number) {
    const data = await this.consumableService.findReplacementSchedule(days ?? 30);
    return ResponseUtil.success(data);
  }

  @Get('calendar')
  @ApiOperation({ summary: '예방보전 캘린더 월별 요약' })
  @SwaggerResponse({ status: 200, description: '조회 성공' })
  async getPmCalendarSummary(@Query() query: PmCalendarQueryDto) {
    const data = await this.consumableService.getPmCalendarSummary(query.year, query.month, query.category);
    return ResponseUtil.success(data);
  }

  @Get('calendar/day')
  @ApiOperation({ summary: '예방보전 캘린더 일별 상세' })
  @SwaggerResponse({ status: 200, description: '조회 성공' })
  async getPmDaySchedule(@Query() query: PmDayScheduleQueryDto) {
    const data = await this.consumableService.getPmDaySchedule(query.date, query.category);
    return ResponseUtil.success(data);
  }

  @Get('category/:category')
  @ApiOperation({ summary: '카테고리별 소모품 목록 조회' })
  @ApiParam({ name: 'category', description: '카테고리', enum: CONSUMABLE_CATEGORY_VALUES })
  async findByCategory(@Param('category') category: string) {
    const data = await this.consumableService.findByCategory(category);
    return ResponseUtil.success(data);
  }

  @Get('code/:consumableCode')
  @ApiOperation({ summary: '소모품 코드로 조회' })
  @ApiParam({ name: 'consumableCode', description: '소모품 코드', example: 'MOLD-001' })
  async findByCode(@Param('consumableCode') consumableCode: string) {
    const data = await this.consumableService.findByCode(consumableCode);
    return ResponseUtil.success(data);
  }

  // =============================================
  // 금형 장착/해제/수리 관리
  // =============================================

  @Get('mounted/:equipCode')
  @ApiOperation({ summary: '설비별 장착된 금형 조회' })
  @ApiParam({ name: 'equipCode', description: '설비 ID' })
  async findMountedByEquip(@Param('equipCode') equipCode: string) {
    const data = await this.consumableService.findMountedByEquip(equipCode);
    return ResponseUtil.success(data);
  }

  @Post(':id/mount')
  @ApiOperation({ summary: '금형 설비 장착' })
  @ApiParam({ name: 'id', description: '소모품(금형) ID' })
  @SwaggerResponse({ status: 200, description: '금형 장착 성공' })
  @SwaggerResponse({ status: 409, description: '이미 장착된 금형' })
  async mountToEquip(@Param('id') id: string, @Body() dto: MountToEquipDto) {
    const data = await this.consumableService.mountToEquip(id, dto);
    return ResponseUtil.success(data, '금형이 설비에 장착되었습니다.');
  }

  @Post(':id/unmount')
  @ApiOperation({ summary: '금형 설비 해제' })
  @ApiParam({ name: 'id', description: '소모품(금형) ID' })
  @SwaggerResponse({ status: 200, description: '금형 해제 성공' })
  async unmountFromEquip(@Param('id') id: string, @Body() dto: UnmountFromEquipDto) {
    const data = await this.consumableService.unmountFromEquip(id, dto);
    return ResponseUtil.success(data, '금형이 설비에서 해제되었습니다.');
  }

  @Post(':id/repair')
  @ApiOperation({ summary: '금형 수리 전환' })
  @ApiParam({ name: 'id', description: '소모품(금형) ID' })
  @SwaggerResponse({ status: 200, description: '수리 전환 성공' })
  async setRepairStatus(@Param('id') id: string, @Body() dto: SetRepairDto) {
    const data = await this.consumableService.setRepairStatus(id, dto);
    return ResponseUtil.success(data, '금형이 수리 상태로 전환되었습니다.');
  }

  @Get(':id/mount-logs')
  @ApiOperation({ summary: '금형 장착/해제 이력 조회' })
  @ApiParam({ name: 'id', description: '소모품(금형) ID' })
  async getMountHistory(@Param('id') id: string) {
    const data = await this.consumableService.getMountHistory(id);
    return ResponseUtil.success(data);
  }

  // =============================================
  // 이미지 업로드
  // =============================================

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (req: any, file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          const uploadPath = './uploads/consumables';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (req: any, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `consumable-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req: any, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!file.mimetype.match(/\/jpg|jpeg|png|gif|webp$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: '소모품 이미지 업로드' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: '소모품 코드' })
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imageUrl = `/uploads/consumables/${file.filename}`;
    const data = await this.consumableService.updateImage(id, imageUrl);
    return ResponseUtil.success(data, '이미지가 업로드되었습니다.');
  }

  @Delete(':id/image')
  @ApiOperation({ summary: '소모품 이미지 삭제' })
  @ApiParam({ name: 'id', description: '소모품 코드' })
  async removeImage(@Param('id') id: string) {
    const existing = await this.consumableService.findByCode(id);
    if (existing.imageUrl) {
      const filePath = join('.', existing.imageUrl);
      try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ignore */ }
    }
    const data = await this.consumableService.updateImage(id, null);
    return ResponseUtil.success(data, '이미지가 삭제되었습니다.');
  }

  // =============================================
  // 기본 CRUD
  // =============================================

  @Get()
  @ApiOperation({ summary: '소모품 목록 조회' })
  @SwaggerResponse({ status: 200, description: '소모품 목록 조회 성공' })
  async findAll(@Query() query: ConsumableQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.consumableService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '소모품 상세 조회' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.consumableService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '소모품 생성' })
  @SwaggerResponse({ status: 201, description: '소모품 생성 성공' })
  @SwaggerResponse({ status: 409, description: '중복된 소모품 코드' })
  async create(@Body() dto: EquipCreateConsumableDto) {
    const data = await this.consumableService.create(dto);
    return ResponseUtil.success(data, '소모품이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '소모품 수정' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @SwaggerResponse({ status: 200, description: '소모품 수정 성공' })
  @SwaggerResponse({ status: 404, description: '소모품을 찾을 수 없음' })
  async update(@Param('id') id: string, @Body() dto: EquipUpdateConsumableDto) {
    const data = await this.consumableService.update(id, dto);
    return ResponseUtil.success(data, '소모품이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '소모품 삭제' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @SwaggerResponse({ status: 200, description: '소모품 삭제 성공' })
  @SwaggerResponse({ status: 404, description: '소모품을 찾을 수 없음' })
  async delete(@Param('id') id: string) {
    await this.consumableService.delete(id);
    return ResponseUtil.success(null, '소모품이 삭제되었습니다.');
  }

  // =============================================
  // 수명 관리
  // =============================================

  @Post(':id/increase')
  @ApiOperation({ summary: '사용 횟수 증가' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @SwaggerResponse({ status: 200, description: '사용 횟수 증가 성공' })
  @SwaggerResponse({ status: 404, description: '소모품을 찾을 수 없음' })
  async increaseCount(@Param('id') id: string, @Body() dto: IncreaseCountDto) {
    const data = await this.consumableService.increaseCount(id, dto);
    return ResponseUtil.success(data, '사용 횟수가 증가되었습니다.');
  }

  @Post(':id/replace')
  @ApiOperation({ summary: '교체 등록' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @SwaggerResponse({ status: 200, description: '교체 등록 성공' })
  @SwaggerResponse({ status: 404, description: '소모품을 찾을 수 없음' })
  async registerReplacement(
    @Param('id') id: string,
    @Body() dto: RegisterReplacementDto,
  ) {
    const data = await this.consumableService.registerReplacement(id, dto);
    return ResponseUtil.success(data, '소모품 교체가 등록되었습니다.');
  }

  // =============================================
  // 소모품 로그
  // =============================================

  @Get(':id/logs')
  @ApiOperation({ summary: '특정 소모품의 로그 조회' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  async findLogsByConsumableId(@Param('id') id: string) {
    const data = await this.consumableService.findLogsByConsumableId(id);
    return ResponseUtil.success(data);
  }
}

/**
 * 소모품 로그 컨트롤러
 */
@ApiTags('설비관리 - 소모품 로그')
@Controller('equipment/consumable-logs')
export class ConsumableLogController {
  constructor(private readonly consumableService: ConsumableService) {}

  @Get()
  @ApiOperation({ summary: '소모품 로그 목록 조회' })
  @SwaggerResponse({ status: 200, description: '소모품 로그 목록 조회 성공' })
  async findLogs(@Query() query: ConsumableLogQueryDto) {
    const result = await this.consumableService.findLogs(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '소모품 로그 생성' })
  @SwaggerResponse({ status: 201, description: '소모품 로그 생성 성공' })
  @SwaggerResponse({ status: 404, description: '소모품을 찾을 수 없음' })
  async createLog(@Body() dto: EquipCreateConsumableLogDto) {
    const data = await this.consumableService.createLog(dto);
    return ResponseUtil.success(data, '소모품 로그가 생성되었습니다.');
  }
}
