/**
 * @file src/modules/master/controllers/part.controller.ts
 * @description 품목마스터 CRUD API 컨트롤러
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
import type { Request } from 'express';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { PartService } from '../services/part.service';
import { CreatePartDto, UpdatePartDto, PartQueryDto } from '../dto/part.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { PART_TYPE_VALUES } from '@harness/shared';

@ApiTags('기준정보 - 품목마스터')
@Controller('master/parts')
export class PartController {
  constructor(private readonly partService: PartService) {}

  @Get('types/:type')
  @ApiOperation({ summary: '품목 유형별 목록 조회' })
  @ApiParam({ name: 'type', enum: PART_TYPE_VALUES })
  async findByType(@Param('type') type: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.partService.findByType(type, company, plant);
    return ResponseUtil.success(data);
  }

  @Get('code/:itemCode')
  @ApiOperation({ summary: '품목 코드로 조회' })
  async findByCode(@Param('itemCode') itemCode: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.partService.findByCode(itemCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '품목 목록 조회' })
  async findAll(@Query() query: PartQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.partService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          const uploadPath = './uploads/parts';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `part-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!file.mimetype.match(/\/jpg|jpeg|png|gif|webp$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: '품목 이미지 업로드' })
  @ApiConsumes('multipart/form-data')
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const imageUrl = `/uploads/parts/${file.filename}`;
    const data = await this.partService.updateImage(id, imageUrl, company, plant);
    return ResponseUtil.success(data, '품목 이미지가 업로드되었습니다.');
  }

  @Delete(':id/image')
  @ApiOperation({ summary: '품목 이미지 삭제' })
  async removeImage(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const existing = await this.partService.findById(id, company, plant);
    if (existing.imageUrl) {
      const filePath = join('.', existing.imageUrl);
      try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ignore */ }
    }
    const data = await this.partService.updateImage(id, null, company, plant);
    return ResponseUtil.success(data, '품목 이미지가 삭제되었습니다.');
  }

  @Get(':id')
  @ApiOperation({ summary: '품목 상세 조회' })
  async findById(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.partService.findById(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '품목 생성' })
  async create(@Body() dto: CreatePartDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.partService.create(dto, company, plant);
    return ResponseUtil.success(data, '품목이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '품목 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdatePartDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.partService.update(id, dto, company, plant);
    return ResponseUtil.success(data, '품목이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '품목 삭제' })
  async delete(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    await this.partService.delete(id, company, plant);
    return ResponseUtil.success(null, '품목이 삭제되었습니다.');
  }
}
