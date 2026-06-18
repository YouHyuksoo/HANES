/**
 * @file src/modules/material/controllers/iqc-history.controller.ts
 * @description IQC 이력 조회 전용 API 컨트롤러
 *              G4: 검사성적서 파일 업로드, G5: 검사필 스탬프 라벨 지원
 */

import { Controller, Get, Post, Query, Body, Param, HttpCode, HttpStatus, UseInterceptors, UploadedFile, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { IqcHistoryService } from '../services/iqc-history.service';
import { IqcHistoryQueryDto, CreateIqcResultDto, CreateArrivalIqcResultDto, PendingArrivalQueryDto, CancelIqcResultDto, PendingSerialsQueryDto } from '../dto/iqc-history.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

const IQC_UPLOAD_DIR = join(process.cwd(), 'uploads', 'iqc-certs');
if (!existsSync(IQC_UPLOAD_DIR)) mkdirSync(IQC_UPLOAD_DIR, { recursive: true });

@ApiTags('자재관리 - IQC이력')
@Controller('material/iqc-history')
export class IqcHistoryController {
  constructor(private readonly iqcHistoryService: IqcHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'IQC 이력 목록 조회' })
  async findAll(@Query() query: IqcHistoryQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.iqcHistoryService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('pending-arrivals')
  @ApiOperation({ summary: 'IQC 검사 대상 목록 (입하번호+품목 단위 그룹)' })
  async findPendingArrivals(@Query() query: PendingArrivalQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.iqcHistoryService.findPendingArrivals(query, company, plant);
    return {
      ...ResponseUtil.success(result.data),
      meta: {
        debugSql: result.debugSql,
      },
    };
  }

  @Get('pending-serials')
  @ApiOperation({ summary: 'IQC 검사대기 시리얼 목록 (입하번호+품목 단위)' })
  async findPendingSerials(@Query() query: PendingSerialsQueryDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.iqcHistoryService.findPendingSerials(query.arrivalNo, query.itemCode, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'IQC 검사결과 등록 (LOT 상태 업데이트 + 이력 생성)' })
  async createResult(@Body() dto: CreateIqcResultDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.iqcHistoryService.createResult(dto, company, plant);
    return ResponseUtil.success(data, 'IQC 검사결과가 등록되었습니다.');
  }

  @Post('arrival')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '입하단위 IQC 검사결과 등록 (입하건 전체 시리얼 일괄 판정)' })
  async createArrivalResult(@Body() dto: CreateArrivalIqcResultDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.iqcHistoryService.createArrivalResult(dto, company, plant);
    return ResponseUtil.success(data, '입하단위 IQC 검사결과가 등록되었습니다.');
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'IQC 판정 취소 (LOT iqcStatus → PENDING 복원)' })
  async cancel(
    @Query('inspectDate') inspectDate: string,
    @Query('seq') seq: string,
    @Body() dto: CancelIqcResultDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.iqcHistoryService.cancel(inspectDate, Number(seq), dto, company, plant);
    return ResponseUtil.success(data, 'IQC 판정이 취소되었습니다.');
  }

  /** G4: 검사성적서 파일 업로드 */
  @Post(':inspectDate/:seq/upload-cert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '검사성적서 파일 업로드' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: IQC_UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `iqc-cert-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadCert(
    @Param('inspectDate') inspectDate: string,
    @Param('seq') seq: string,
    @UploadedFile() file: Express.Multer.File,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    if (!file) {
      throw new BadRequestException('업로드할 파일이 없습니다. (multipart/form-data의 file 필드 필요)');
    }
    const data = await this.iqcHistoryService.uploadCert(inspectDate, Number(seq), file.path, company, plant);
    return ResponseUtil.success(data, '검사성적서가 업로드되었습니다.');
  }
}
