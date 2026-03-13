/**
 * @file src/modules/master/controllers/worker.controller.ts
 * @description 작업자마스터 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/workers**: 작업자 목록 조회 (부서, 검색 필터)
 * 2. **GET /master/workers/by-qr/:qrCode**: QR 코드로 작업자 조회 (PDA 연동)
 * 3. **POST /master/workers**: 작업자 생성
 * 4. **PUT /master/workers/:id**: 작업자 수정
 * 5. **DELETE /master/workers/:id**: 작업자 삭제
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { WorkerService } from '../services/worker.service';
import { CreateWorkerDto, UpdateWorkerDto, WorkerQueryDto } from '../dto/worker.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 작업자마스터')
@Controller('master/workers')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Get()
  @ApiOperation({ summary: '작업자 목록 조회' })
  async findAll(@Query() query: WorkerQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.workerService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('by-qr/:qrCode')
  @ApiOperation({ summary: 'QR 코드로 작업자 조회 (PDA 연동)' })
  async findByQrCode(@Param('qrCode') qrCode: string) {
    const data = await this.workerService.findByQrCode(qrCode);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: '작업자 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.workerService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '작업자 생성' })
  async create(@Body() dto: CreateWorkerDto) {
    const data = await this.workerService.create(dto);
    return ResponseUtil.success(data, '작업자가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '작업자 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    const data = await this.workerService.update(id, dto);
    return ResponseUtil.success(data, '작업자가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '작업자 삭제' })
  async delete(@Param('id') id: string) {
    await this.workerService.delete(id);
    return ResponseUtil.success(null, '작업자가 삭제되었습니다.');
  }

  @Post('upload-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadPath = './uploads/workers';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (_req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `worker-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(new Error('이미지 파일만 업로드 가능합니다.'), false);
        }
        callback(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '작업자 사진 업로드' })
  @ApiConsumes('multipart/form-data')
  uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    const fileUrl = `/uploads/workers/${file.filename}`;
    return ResponseUtil.success({ url: fileUrl }, '사진이 업로드되었습니다.');
  }
}
