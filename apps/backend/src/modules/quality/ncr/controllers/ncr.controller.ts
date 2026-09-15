/**
 * @file quality/ncr/controllers/ncr.controller.ts
 * @description 부적합 보고서(NCR) API
 *
 * - GET    /quality/ncr            : 목록(발행일 구간)
 * - GET    /quality/ncr/:ncrNo     : 단건
 * - POST   /quality/ncr            : 발행
 * - PUT    /quality/ncr/:ncrNo     : 수정 (종결 건은 불가)
 * - PATCH  /quality/ncr/:ncrNo/disposition : 처리방안 확정
 * - PATCH  /quality/ncr/:ncrNo/cause       : 원인·재발방지
 * - PATCH  /quality/ncr/:ncrNo/close       : 종결
 * - PATCH  /quality/ncr/:ncrNo/capa        : 시정조치(CAPA) 연결
 */
import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put,
  Query, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { Company, Plant } from '../../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../../common/dto/response.dto';
import { AuthenticatedRequest } from '../../../../common/guards/jwt-auth.guard';
import { NcrService } from '../services/ncr.service';
import { NcrAttachmentService, type UploadedFileInfo } from '../services/ncr-attachment.service';
import {
  CloseNcrDto, CreateNcrDto, NcrCauseDto, NcrDispositionDto, NcrQueryDto, UpdateNcrDto,
} from '../dto/ncr.dto';

@ApiTags('quality')
@Controller('quality/ncr')
export class NcrController {
  constructor(
    private readonly svc: NcrService,
    private readonly attachSvc: NcrAttachmentService,
  ) {}

  @Get()
  @ApiOperation({ summary: '부적합 보고서 목록', description: '발행일 구간·대상구분·발견공정·등급·상태 필터' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: NcrQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.svc.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':ncrNo')
  @ApiOperation({ summary: '부적합 보고서 단건' })
  @ApiParam({ name: 'ncrNo' })
  async findOne(@Param('ncrNo') ncrNo: string, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.svc.findOne(ncrNo, company, plant));
  }

  @Post()
  @ApiOperation({
    summary: '부적합 보고서 발행',
    description: '같은 출처(sourceType+sourceId)로 이미 발행된 건이 있으면 거부한다.',
  })
  async create(
    @Body() dto: CreateNcrDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.create(dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '부적합 보고서가 발행되었습니다.');
  }

  @Put(':ncrNo')
  @ApiOperation({ summary: '부적합 보고서 수정', description: '종결된 건은 수정할 수 없다.' })
  async update(
    @Param('ncrNo') ncrNo: string,
    @Body() dto: UpdateNcrDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.update(ncrNo, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '부적합 보고서가 수정되었습니다.');
  }

  @Patch(':ncrNo/disposition')
  @ApiOperation({ summary: '처리방안 확정', description: '특채/수리/재작업/폐기/반품 + 기한·책임자' })
  async setDisposition(
    @Param('ncrNo') ncrNo: string,
    @Body() dto: NcrDispositionDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.setDisposition(ncrNo, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '처리방안이 확정되었습니다.');
  }

  @Patch(':ncrNo/cause')
  @ApiOperation({ summary: '원인분석·재발방지', description: '4M1E 분류 + 원인 + 대책' })
  async setCause(
    @Param('ncrNo') ncrNo: string,
    @Body() dto: NcrCauseDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.setCause(ncrNo, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '원인·재발방지 대책이 저장되었습니다.');
  }

  @Patch(':ncrNo/close')
  @ApiOperation({
    summary: '부적합 보고서 종결',
    description: '처리방안과 발생 원인이 모두 채워져야 종결할 수 있다.',
  })
  async close(
    @Param('ncrNo') ncrNo: string,
    @Body() dto: CloseNcrDto,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.close(ncrNo, dto, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '부적합 보고서가 종결되었습니다.');
  }

  @Patch(':ncrNo/capa')
  @ApiOperation({ summary: '시정조치(CAPA) 연결' })
  async linkCapa(
    @Param('ncrNo') ncrNo: string,
    @Body('capaNo') capaNo: string,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.svc.linkCapa(ncrNo, capaNo, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(data, '시정조치가 연결되었습니다.');
  }

  // ── 첨부파일 (문서·이미지) ────────────────────────────────────────────────

  @Get(':ncrNo/attachments')
  @ApiOperation({ summary: '첨부파일 목록' })
  @ApiParam({ name: 'ncrNo' })
  async listAttachments(
    @Param('ncrNo') ncrNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    return ResponseUtil.success(await this.attachSvc.findAll(ncrNo, company, plant));
  }

  @Post(':ncrNo/attachments')
  @ApiOperation({
    summary: '첨부파일 등록',
    description: '현상 사진·측정 성적서·고객 클레임 문서 등. 종결된 건에는 올릴 수 없다.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadPath = './uploads/ncr-attachments';
          if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
          callback(null, uploadPath);
        },
        filename: (_req, file, callback) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `ncr-${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        // 확장자를 우선 본다 — pptx/ppsx 등은 브라우저가 mimetype 을 비우거나 제각각으로 보낸다
        const okByExt = /\.(jpe?g|png|gif|bmp|webp|pdf|pptx?|ppsx?|docx?|xlsx?|csv|txt)$/i
          .test(file.originalname);
        const okByMime = /(^image\/|\/pdf$|officedocument|ms-?powerpoint|msword|ms-excel|\/plain$|\/csv$)/i
          .test(file.mimetype);
        if (okByExt || okByMime) return callback(null, true);
        callback(new BadRequestException('이미지·PDF·오피스 문서만 첨부할 수 있습니다.'), false);
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadAttachment(
    @Param('ncrNo') ncrNo: string,
    @UploadedFile() file: UploadedFileInfo | undefined,
    @Body('remark') remark: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    if (!file) throw new BadRequestException('첨부할 파일이 없습니다.');
    const data = await this.attachSvc.create(
      ncrNo, file, remark, req.user?.id ?? 'system', company, plant,
    );
    return ResponseUtil.success(data, '첨부파일이 등록되었습니다.');
  }

  @Delete(':ncrNo/attachments/:seq')
  @ApiOperation({ summary: '첨부파일 삭제', description: '종결된 건에서는 삭제할 수 없다.' })
  async removeAttachment(
    @Param('ncrNo') ncrNo: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Req() req: AuthenticatedRequest,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    await this.attachSvc.remove(ncrNo, seq, req.user?.id ?? 'system', company, plant);
    return ResponseUtil.success(null, '첨부파일이 삭제되었습니다.');
  }
}
