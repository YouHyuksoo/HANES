/**
 * @file src/modules/master/controllers/work-instruction.controller.ts
 * @description 작업지도서 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /master/work-instructions**: 작업지도서 목록 (itemCode, processCode 필터)
 * 2. **POST /master/work-instructions**: 작업지도서 생성
 * 3. **PUT /master/work-instructions/:id**: 작업지도서 수정
 * 4. **DELETE /master/work-instructions/:id**: 작업지도서 삭제
 * 5. **POST /master/work-instructions/upload**: 파일 업로드 (이미지, PDF 등)
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { WorkInstructionService } from '../services/work-instruction.service';
import { CreateWorkInstructionDto, UpdateWorkInstructionDto, WorkInstructionQueryDto } from '../dto/work-instruction.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 작업지도서')
@Controller('master/work-instructions')
export class WorkInstructionController {
  constructor(private readonly workInstructionService: WorkInstructionService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadPath = './uploads/work-instructions';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (_req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `wi-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf|msword|vnd\.openxmlformats|vnd\.ms-excel|plain)$/)) {
          return callback(new Error('지원하지 않는 파일 형식입니다.'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '작업지도서 파일 업로드' })
  @ApiConsumes('multipart/form-data')
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    const fileUrl = `/uploads/work-instructions/${file.filename}`;
    return ResponseUtil.success({
      url: fileUrl,
      originalName: file.originalname,
      size: file.size,
    }, '파일이 업로드되었습니다.');
  }

  @Get()
  @ApiOperation({ summary: '작업지도서 목록 조회' })
  async findAll(@Query() query: WorkInstructionQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.workInstructionService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '작업지도서 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.workInstructionService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '작업지도서 생성' })
  async create(@Body() dto: CreateWorkInstructionDto) {
    const data = await this.workInstructionService.create(dto);
    return ResponseUtil.success(data, '작업지도서가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '작업지도서 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateWorkInstructionDto) {
    const data = await this.workInstructionService.update(id, dto);
    return ResponseUtil.success(data, '작업지도서가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '작업지도서 삭제' })
  async delete(@Param('id') id: string) {
    await this.workInstructionService.delete(id);
    return ResponseUtil.success(null, '작업지도서가 삭제되었습니다.');
  }
}
