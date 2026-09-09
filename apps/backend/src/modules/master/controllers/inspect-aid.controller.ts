/**
 * @file inspect-aid.controller.ts
 * @description 검사보조구 마스터(한도견본·검사홀더) API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET    /master/inspect-aids             — 목록(페이징·유형/상태/품목/공정 필터)
 * 2. GET    /master/inspect-aids/expiring    — ?days=30 유효기간 만료·임박 목록
 * 3. GET    /master/inspect-aids/:code       — 상세
 * 4. POST   /master/inspect-aids             — 생성
 * 5. PUT    /master/inspect-aids/:code       — 수정
 * 6. POST   /master/inspect-aids/:code/image — 사진 업로드 (multer, uploads/inspect-aids)
 * 7. DELETE /master/inspect-aids/:code/image — 사진 삭제 (파일 + IMAGE_URL 해제)
 * 8. DELETE /master/inspect-aids/:code       — 삭제 (사진 파일도 함께 정리)
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, Post, Put, Query, Req,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { Request } from 'express';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { InspectAidService } from '../services/inspect-aid.service';
import {
  CreateInspectAidDto,
  InspectAidExpiringQueryDto,
  InspectAidQueryDto,
  UpdateInspectAidDto,
} from '../dto/inspect-aid.dto';

const UPLOAD_DIR = './uploads/inspect-aids';

@ApiTags('기준정보 - 검사보조구(한도견본·검사홀더)')
@Controller('master/inspect-aids')
export class InspectAidController {
  private readonly logger = new Logger(InspectAidController.name);

  constructor(private readonly service: InspectAidService) {}

  @Get()
  @ApiOperation({ summary: '검사보조구 목록 조회' })
  async findAll(@Query() query: InspectAidQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('expiring')
  @ApiOperation({ summary: '유효기간 만료·임박 검사보조구 조회 (?days=30)' })
  async findExpiring(@Query() query: InspectAidExpiringQueryDto, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findExpiring(query.days ?? 30, company, plant));
  }

  @Get(':aidCode')
  @ApiOperation({ summary: '검사보조구 상세 조회' })
  async findOne(@Param('aidCode') aidCode: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(this.service.toView(await this.service.findByCode(aidCode, company, plant)));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '검사보조구 생성' })
  async create(
    @Body() dto: CreateInspectAidDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.create(dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '검사보조구가 등록되었습니다.');
  }

  @Put(':aidCode')
  @ApiOperation({ summary: '검사보조구 수정' })
  async update(
    @Param('aidCode') aidCode: string,
    @Body() dto: UpdateInspectAidDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.update(aidCode, dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '검사보조구가 수정되었습니다.');
  }

  @Post(':aidCode/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
          callback(null, UPLOAD_DIR);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `inspect-aid-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        if (!/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: '검사보조구 사진 업로드 (교체 시 기존 파일 삭제)' })
  @ApiConsumes('multipart/form-data')
  async uploadImage(
    @Param('aidCode') aidCode: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('업로드할 이미지 파일이 없습니다.');
    const existing = await this.service.findByCode(aidCode, company, plant);
    this.removeFile(existing.imageUrl, aidCode);
    const imageUrl = `/uploads/inspect-aids/${file.filename}`;
    const data = await this.service.updateImage(aidCode, imageUrl, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '검사보조구 사진이 업로드되었습니다.');
  }

  @Delete(':aidCode/image')
  @ApiOperation({ summary: '검사보조구 사진 삭제' })
  async removeImage(
    @Param('aidCode') aidCode: string,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const existing = await this.service.findByCode(aidCode, company, plant);
    this.removeFile(existing.imageUrl, aidCode);
    const data = await this.service.updateImage(aidCode, null, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '검사보조구 사진이 삭제되었습니다.');
  }

  @Delete(':aidCode')
  @ApiOperation({ summary: '검사보조구 삭제' })
  async delete(@Param('aidCode') aidCode: string, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.delete(aidCode, company, plant);
    this.removeFile(result.imageUrl, aidCode);
    return ResponseUtil.success(null, '검사보조구가 삭제되었습니다.');
  }

  /** 파일 삭제 실패는 DB 갱신을 막지 않는다 — 고아 파일 추적용 경고 로깅만 남긴다. */
  private removeFile(imageUrl: string | null | undefined, aidCode: string) {
    if (!imageUrl) return;
    const filePath = join('.', imageUrl);
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch (error: unknown) {
      this.logger.warn(
        `검사보조구 이미지 파일 삭제 실패 (aidCode=${aidCode}, path=${filePath}): ${error instanceof Error ? error.message : '오류'}`,
      );
    }
  }
}
