/**
 * @file src/modules/master/controllers/label-template.controller.ts
 * @description 라벨 템플릿 컨트롤러 - CRUD API 엔드포인트
 *
 * API:
 * - GET    /api/v1/master/label-templates      : 목록 조회
 * - GET    /api/v1/master/label-templates/:id   : 단건 조회
 * - POST   /api/v1/master/label-templates       : 생성
 * - PUT    /api/v1/master/label-templates/:id   : 수정
 * - DELETE /api/v1/master/label-templates/:id   : 삭제
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
import { ApiTags, ApiOperation, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { LabelTemplateService } from '../services/label-template.service';
import {
  CreateLabelTemplateDto,
  UpdateLabelTemplateDto,
  LabelTemplateQueryDto,
} from '../dto/label-template.dto';

@ApiTags('기준정보 - 라벨 템플릿')
@Controller('master/label-templates')
export class LabelTemplateController {
  constructor(
    private readonly labelTemplateService: LabelTemplateService,
  ) {}

  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          const uploadPath = './uploads/label-templates';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          callback(null, uploadPath);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `label-image-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        const okByExt = /\.(jpe?g|png|gif|webp|svg)$/i.test(file.originalname);
        const okByMime = /^image\/(jpeg|png|gif|webp|svg\+xml)$/i.test(file.mimetype);
        if (!okByExt && !okByMime) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '라벨 템플릿 이미지 업로드' })
  @ApiConsumes('multipart/form-data')
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    const imageUrl = `/uploads/label-templates/${file.filename}`;
    return ResponseUtil.success({
      url: imageUrl,
      originalName: file.originalname,
      size: file.size,
    }, '라벨 이미지가 업로드되었습니다.');
  }

  @Get()
  @ApiOperation({ summary: '라벨 템플릿 목록 조회' })
  async findAll(@Query() query: LabelTemplateQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.labelTemplateService.findAll(query, company, plant);
    return ResponseUtil.paged(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '라벨 템플릿 단건 조회' })
  @ApiParam({ name: 'id', description: '라벨 템플릿 ID' })
  async findById(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.labelTemplateService.findById(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '라벨 템플릿 생성' })
  async create(@Body() dto: CreateLabelTemplateDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.labelTemplateService.create(dto, company, plant);
    return ResponseUtil.success(data, '라벨 템플릿이 저장되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '라벨 템플릿 수정' })
  @ApiParam({ name: 'id', description: '라벨 템플릿 ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLabelTemplateDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.labelTemplateService.update(id, dto, company, plant);
    return ResponseUtil.success(data, '라벨 템플릿이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '라벨 템플릿 삭제' })
  @ApiParam({ name: 'id', description: '라벨 템플릿 ID' })
  async delete(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    await this.labelTemplateService.delete(id, company, plant);
    return ResponseUtil.success(null, '라벨 템플릿이 삭제되었습니다.');
  }
}
