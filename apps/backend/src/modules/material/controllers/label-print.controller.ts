/**
 * @file controllers/label-print.controller.ts
 * @description 라벨 인쇄 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. POST /material/label-print/generate - ZPL 변수 치환 결과 반환
 * 2. POST /material/label-print/tcp - TCP/IP 프린터 전송 (옵션)
 * 3. POST /material/label-print/log - 발행 이력 저장
 * 4. GET /material/label-print/logs - 발행 이력 조회
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { LabelPrintService } from '../services/label-print.service';
import {
  GenerateZplDto,
  TcpPrintDto,
  CreatePrintLogDto,
  PrintLogQueryDto,
} from '../dto/label-print.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 라벨 인쇄')
@Controller('material/label-print')
export class LabelPrintController {
  constructor(private readonly labelPrintService: LabelPrintService) {}

  /** ZPL 변수 치환 결과 반환 */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ZPL 변수 치환 결과 반환' })
  async generateZpl(@Body() dto: GenerateZplDto) {
    const data = await this.labelPrintService.generateZpl(dto);
    return ResponseUtil.success(data);
  }

  /** TCP/IP 프린터로 ZPL 전송 */
  @Post('tcp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'TCP/IP 프린터로 ZPL 전송' })
  async printViaTcp(@Body() dto: TcpPrintDto) {
    const data = await this.labelPrintService.printViaTcp(dto);
    return ResponseUtil.success(data);
  }

  /** 발행 이력 저장 */
  @Post('log')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '발행 이력 저장' })
  async createLog(
    @Body() dto: CreatePrintLogDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.labelPrintService.createLog(dto, company, plant);
    return ResponseUtil.success(data);
  }

  /** 발행 이력 조회 */
  @Get('logs')
  @ApiOperation({ summary: '발행 이력 조회' })
  async findLogs(
    @Query() query: PrintLogQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.labelPrintService.findLogs(
      query,
      company,
      plant,
    );
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }
}
