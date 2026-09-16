/**
 * @file limit-sample.controller.ts
 * @description 양불마스터(양품/불량 한도견본) API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET    /master/limit-samples                    — 목록(페이징·유형/상태/품목/공정 필터)
 * 2. GET    /master/limit-samples/expiring           — ?days=30 유효기간 만료·임박 목록
 * 3. GET    /master/limit-samples/:code              — 상세 (사진 목록 포함)
 * 4. POST   /master/limit-samples                    — 생성
 * 5. PUT    /master/limit-samples/:code              — 수정
 * 6. POST   /master/limit-samples/:code/images       — 사진 추가 (multer, uploads/limit-samples)
 * 7. PUT    /master/limit-samples/:code/images/:seq  — 사진 설명·대표·순서 수정
 * 8. DELETE /master/limit-samples/:code/images/:seq  — 사진 삭제 (파일 포함)
 * 9. DELETE /master/limit-samples/:code              — 삭제 (사진 행·파일도 함께 정리)
 *
 * 라우트 주의: 'expiring'은 ':sampleCode'보다 먼저 선언해야 코드로 오인되지 않는다.
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Post, Put, Query, Req,
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
import { LimitSampleService } from '../services/limit-sample.service';
import {
  CreateLimitSampleDto,
  LimitSampleExpiringQueryDto,
  LimitSampleQueryDto,
  UpdateLimitSampleDto,
  UpdateLimitSampleImageDto,
} from '../dto/limit-sample.dto';

const UPLOAD_DIR = './uploads/limit-samples';

@ApiTags('기준정보 - 양불마스터(한도견본)')
@Controller('master/limit-samples')
export class LimitSampleController {
  private readonly logger = new Logger(LimitSampleController.name);

  constructor(private readonly service: LimitSampleService) {}

  @Get()
  @ApiOperation({ summary: '양불마스터 목록 조회' })
  async findAll(@Query() query: LimitSampleQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('expiring')
  @ApiOperation({ summary: '유효기간 만료·임박 견본 조회 (?days=30)' })
  async findExpiring(
    @Query() query: LimitSampleExpiringQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    return ResponseUtil.success(await this.service.findExpiring(query.days ?? 30, company, plant));
  }

  @Get(':sampleCode')
  @ApiOperation({ summary: '양불마스터 상세 조회 (사진 목록 포함)' })
  async findOne(@Param('sampleCode') sampleCode: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findDetail(sampleCode, company, plant));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '양불마스터 생성' })
  async create(
    @Body() dto: CreateLimitSampleDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.create(dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '견본이 등록되었습니다.');
  }

  @Put(':sampleCode')
  @ApiOperation({ summary: '양불마스터 수정' })
  async update(
    @Param('sampleCode') sampleCode: string,
    @Body() dto: UpdateLimitSampleDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.update(sampleCode, dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '견본이 수정되었습니다.');
  }

  @Post(':sampleCode/images')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req: Request, _file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
          if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
          callback(null, UPLOAD_DIR);
        },
        filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `limit-sample-${uniqueSuffix}${extname(file.originalname)}`);
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
  @ApiOperation({ summary: '견본 사진 추가 (첫 장은 자동으로 대표가 된다)' })
  @ApiConsumes('multipart/form-data')
  async addImage(
    @Param('sampleCode') sampleCode: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('업로드할 이미지 파일이 없습니다.');
    const imageUrl = `/uploads/limit-samples/${file.filename}`;
    const data = await this.service.addImage(sampleCode, imageUrl, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '견본 사진이 등록되었습니다.');
  }

  @Put(':sampleCode/images/:seqNo')
  @ApiOperation({ summary: '견본 사진 설명·대표·순서 수정' })
  async updateImage(
    @Param('sampleCode') sampleCode: string,
    @Param('seqNo', ParseIntPipe) seqNo: number,
    @Body() dto: UpdateLimitSampleImageDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.updateImageMeta(sampleCode, seqNo, dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '견본 사진이 수정되었습니다.');
  }

  @Delete(':sampleCode/images/:seqNo')
  @ApiOperation({ summary: '견본 사진 삭제 (파일 포함)' })
  async removeImage(
    @Param('sampleCode') sampleCode: string,
    @Param('seqNo', ParseIntPipe) seqNo: number,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.service.removeImage(sampleCode, seqNo, company, plant);
    this.removeFile(result.imageUrl, sampleCode);
    return ResponseUtil.success(result.view, '견본 사진이 삭제되었습니다.');
  }

  @Delete(':sampleCode')
  @ApiOperation({ summary: '양불마스터 삭제 (사진 행·파일도 함께 정리)' })
  async delete(@Param('sampleCode') sampleCode: string, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.delete(sampleCode, company, plant);
    for (const imageUrl of result.imageUrls) this.removeFile(imageUrl, sampleCode);
    return ResponseUtil.success(null, '견본이 삭제되었습니다.');
  }

  /** 파일 삭제 실패는 DB 갱신을 막지 않는다 — 고아 파일 추적용 경고 로깅만 남긴다. */
  private removeFile(imageUrl: string | null | undefined, sampleCode: string) {
    if (!imageUrl) return;
    const filePath = join('.', imageUrl);
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch (error: unknown) {
      this.logger.warn(
        `견본 이미지 파일 삭제 실패 (sampleCode=${sampleCode}, path=${filePath}): ${error instanceof Error ? error.message : '오류'}`,
      );
    }
  }
}
