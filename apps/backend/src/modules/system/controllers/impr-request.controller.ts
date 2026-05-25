/**
 * @file controllers/impr-request.controller.ts
 * @description 개선요청 API - /system/improvement-requests
 *
 * 초보자 가이드:
 * 1. Authorization 헤더에서 userId 추출 (activity-log.controller와 동일 패턴)
 * 2. x-company, x-plant 헤더에서 멀티테넌시 정보 추출
 * 3. 목록 조회 시 screenshot 컬럼 제외 (대용량, 단건 조회 시에만 포함)
 */
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { ImprRequestService } from '../services/impr-request.service';
import {
  CreateImprRequestDto,
  UpdateImprStatusDto,
  ImprRequestQueryDto,
} from '../dto/impr-request.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { getHeaderString } from '../../../common/utils/header-value.util';
import { getRequestUser } from '../../../common/utils/request-user.util';

@ApiTags('시스템관리 - 개선요청')
@Controller('system/improvement-requests')
export class ImprRequestController {
  constructor(private readonly service: ImprRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '개선요청 등록' })
  async create(@Body() dto: CreateImprRequestDto, @Req() req: Request) {
    const { userId, userName, company, plantCd } = this.extractMeta(req);
    const item = await this.service.create(dto, userId, userName, company, plantCd);
    return ResponseUtil.success(item);
  }

  @Get()
  @ApiOperation({ summary: '개선요청 목록 조회 (스크린샷 제외)' })
  async findAll(@Query() query: ImprRequestQueryDto, @Req() req: Request) {
    const { company, plantCd } = this.extractMeta(req);
    const result = await this.service.findAll(query, company, plantCd);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '개선요청 단건 조회 (스크린샷 포함)' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const { company, plantCd } = this.extractMeta(req);
    const item = await this.service.findOne(id, company, plantCd);
    return ResponseUtil.success(item);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '개선요청 상태 변경' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateImprStatusDto,
    @Req() req: Request,
  ) {
    const { company, plantCd } = this.extractMeta(req);
    const item = await this.service.updateStatus(id, dto, company, plantCd);
    return ResponseUtil.success(item);
  }

  private extractMeta(req: Request) {
    const user = getRequestUser(req) ?? {};
    const auth = req.headers.authorization ?? '';
    const [, token] = auth.split(' ');
    const userId = user.id || token || 'unknown';
    const userName = getHeaderString(req.headers['x-user-name']) ?? null;
    const company = getHeaderString(req.headers['x-company']) ?? user.company;
    const plantCd = getHeaderString(req.headers['x-plant']) ?? user.plant;
    if (!company || !plantCd) {
      throw new BadRequestException('회사/사업장 정보가 없습니다.');
    }
    return { userId, userName, company, plantCd };
  }
}
