/**
 * @file src/modules/material/controllers/issue-request.controller.ts
 * @description 자재 출고요청 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **POST /**: 출고요청 생성 (상태: REQUESTED)
 * 2. **GET /**: 출고요청 목록 조회 (페이지네이션 + 상태 필터)
 * 3. **GET /:id**: 출고요청 상세 조회 (품목 포함)
 * 4. **PATCH /:id/approve**: 출고요청 승인 (REQUESTED → APPROVED)
 * 5. **PATCH /:id/reject**: 출고요청 반려 (REQUESTED → REJECTED)
 * 6. **POST /:id/issue**: 승인된 요청 기반 실출고 (APPROVED → COMPLETED)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { IssueRequestService } from '../services/issue-request.service';
import {
  CreateIssueRequestDto,
  IssueRequestQueryDto,
  RejectIssueRequestDto,
  RequestIssueDto,
} from '../dto/issue-request.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - 출고요청')
@Controller('material/issue-requests')
export class IssueRequestController {
  constructor(
    private readonly issueRequestService: IssueRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '출고요청 생성' })
  async create(@Body() dto: CreateIssueRequestDto) {
    const data = await this.issueRequestService.create(dto);
    return ResponseUtil.success(data, '출고요청이 생성되었습니다.');
  }

  @Get()
  @ApiOperation({ summary: '출고요청 목록 조회' })
  async findAll(@Query() query: IssueRequestQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.issueRequestService.findAll(query, company, plant);
    return ResponseUtil.paged(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '출고요청 상세 조회' })
  @ApiParam({ name: 'id', description: '출고요청 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.issueRequestService.findById(id);
    return ResponseUtil.success(data);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: '출고요청 승인' })
  @ApiParam({ name: 'id', description: '출고요청 ID' })
  async approve(@Param('id') id: string) {
    const data = await this.issueRequestService.approve(id);
    return ResponseUtil.success(data, '출고요청이 승인되었습니다.');
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: '출고요청 반려' })
  @ApiParam({ name: 'id', description: '출고요청 ID' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectIssueRequestDto,
  ) {
    const data = await this.issueRequestService.reject(id, dto);
    return ResponseUtil.success(data, '출고요청이 반려되었습니다.');
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '출고요청 기반 실출고' })
  @ApiParam({ name: 'id', description: '출고요청 ID' })
  async issueFromRequest(
    @Param('id') id: string,
    @Body() dto: RequestIssueDto,
  ) {
    const data = await this.issueRequestService.issueFromRequest(id, dto);
    return ResponseUtil.success(data, '출고가 완료되었습니다.');
  }
}
