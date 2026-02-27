/**
 * @file src/modules/consumables/controllers/consumables.controller.ts
 * @description 소모품관리 API 컨트롤러
 *
 * API 구조:
 * - GET  /consumables                : 소모품 목록
 * - GET  /consumables/:id            : 소모품 상세
 * - POST /consumables                : 소모품 등록
 * - PUT  /consumables/:id            : 소모품 수정
 * - DELETE /consumables/:id          : 소모품 삭제
 * - GET  /consumables/logs           : 입출고 이력 목록
 * - POST /consumables/logs           : 입출고 이력 등록
 * - POST /consumables/shot-count     : 타수 업데이트
 * - POST /consumables/reset          : 타수 리셋
 * - GET  /consumables/summary        : 현황 요약
 * - GET  /consumables/warning        : 경고/교체 필요 목록
 * - GET  /consumables/life-status    : 수명 현황
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
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { ConsumablesService } from '../services/consumables.service';
import {
  CreateConsumableDto,
  UpdateConsumableDto,
  ConsumableQueryDto,
  CreateConsumableLogDto,
  ConsumableLogQueryDto,
  UpdateShotCountDto,
  ResetShotCountDto,
} from '../dto/consumables.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('소모품관리')
@Controller('consumables')
export class ConsumablesController {
  constructor(private readonly consumablesService: ConsumablesService) {}

  // ===== 소모품 마스터 =====

  @Get()
  @ApiOperation({ summary: '소모품 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ConsumableQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.consumablesService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('summary')
  @ApiOperation({ summary: '소모품 현황 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummary() {
    const data = await this.consumablesService.getSummary();
    return ResponseUtil.success(data);
  }

  @Get('warning')
  @ApiOperation({ summary: '경고/교체 필요 소모품 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getWarningList() {
    const data = await this.consumablesService.getWarningList();
    return ResponseUtil.success(data);
  }

  @Get('life-status')
  @ApiOperation({ summary: '소모품 수명 현황' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getLifeStatus() {
    const data = await this.consumablesService.getLifeStatus();
    return ResponseUtil.success(data);
  }

  @Get('stock-status')
  @ApiOperation({ summary: '소모품 재고 현황' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getStockStatus(@Query() query: ConsumableQueryDto) {
    const result = await this.consumablesService.getStockStatus(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('logs')
  @ApiOperation({ summary: '입출고 이력 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllLogs(@Query() query: ConsumableLogQueryDto) {
    const result = await this.consumablesService.findAllLogs(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  // ===== 이미지 관리 =====

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
    const data = await this.consumablesService.updateImage(id, imageUrl);
    return ResponseUtil.success(data, '이미지가 업로드되었습니다.');
  }

  @Delete(':id/image')
  @ApiOperation({ summary: '소모품 이미지 삭제' })
  @ApiParam({ name: 'id', description: '소모품 코드' })
  async removeImage(@Param('id') id: string) {
    const existing = await this.consumablesService.findById(id);
    if (existing.imageUrl) {
      const filePath = join('.', existing.imageUrl);
      try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ignore */ }
    }
    const data = await this.consumablesService.updateImage(id, null);
    return ResponseUtil.success(data, '이미지가 삭제되었습니다.');
  }

  @Get(':id')
  @ApiOperation({ summary: '소모품 상세 조회' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findById(@Param('id') id: string) {
    const data = await this.consumablesService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '소모품 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async create(@Body() dto: CreateConsumableDto) {
    const data = await this.consumablesService.create(dto);
    return ResponseUtil.success(data, '소모품이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '소모품 수정' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async update(@Param('id') id: string, @Body() dto: UpdateConsumableDto) {
    const data = await this.consumablesService.update(id, dto);
    return ResponseUtil.success(data, '소모품이 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '소모품 삭제' })
  @ApiParam({ name: 'id', description: '소모품 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async delete(@Param('id') id: string) {
    await this.consumablesService.delete(id);
    return ResponseUtil.success(null, '소모품이 삭제되었습니다.');
  }

  // ===== 입출고 이력 =====

  @Post('logs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '입출고 이력 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createLog(@Body() dto: CreateConsumableLogDto) {
    const data = await this.consumablesService.createLog(dto);
    return ResponseUtil.success(data, '입출고 이력이 등록되었습니다.');
  }

  // ===== 타수 관리 =====

  @Post('shot-count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '타수 업데이트' })
  @ApiResponse({ status: 200, description: '업데이트 성공' })
  async updateShotCount(@Body() dto: UpdateShotCountDto) {
    const data = await this.consumablesService.updateShotCount(dto);
    return ResponseUtil.success(data, '타수가 업데이트되었습니다.');
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '타수 리셋 (교체 시)' })
  @ApiResponse({ status: 200, description: '리셋 성공' })
  async resetShotCount(@Body() dto: ResetShotCountDto) {
    const data = await this.consumablesService.resetShotCount(dto);
    return ResponseUtil.success(data, '타수가 리셋되었습니다.');
  }
}
