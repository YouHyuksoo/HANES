/**
 * @file terminal-crimp-spec.controller.ts
 * @description 단자별 압착 규격 마스터 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET    /master/terminal-crimp-specs           — 목록(페이징·필터)
 * 2. GET    /master/terminal-crimp-specs/resolve   — ?terminalItemCode&wireSize 로 사용중 규격 1건(없으면 null)
 * 3. GET    /master/terminal-crimp-specs/:specId   — 상세
 * 4. POST   /master/terminal-crimp-specs           — 생성(SEQ 채번)
 * 5. PUT    /master/terminal-crimp-specs/:specId   — 수정
 * 6. DELETE /master/terminal-crimp-specs/:specId   — 삭제
 */
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query, Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { TerminalCrimpSpecService } from '../services/terminal-crimp-spec.service';
import {
  CreateTerminalCrimpSpecDto,
  TerminalCrimpSpecQueryDto,
  TerminalCrimpSpecResolveQueryDto,
  UpdateTerminalCrimpSpecDto,
} from '../dto/terminal-crimp-spec.dto';

@ApiTags('기준정보 - 단자별 압착 규격')
@Controller('master/terminal-crimp-specs')
export class TerminalCrimpSpecController {
  constructor(private readonly service: TerminalCrimpSpecService) {}

  @Get()
  @ApiOperation({ summary: '압착 규격 목록 조회' })
  async findAll(@Query() query: TerminalCrimpSpecQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('resolve')
  @ApiOperation({ summary: '단자품목+전선사이즈로 사용중 압착 규격 조회 (자주검사·계측 판정용)' })
  async resolve(@Query() query: TerminalCrimpSpecResolveQueryDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.service.resolve(query.terminalItemCode, query.wireSize, company, plant);
    return ResponseUtil.success(data);
  }

  @Get(':specId')
  @ApiOperation({ summary: '압착 규격 상세 조회' })
  async findOne(@Param('specId', ParseIntPipe) specId: number, @Company() company: string, @Plant() plant: string) {
    return ResponseUtil.success(await this.service.findById(specId, company, plant));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '압착 규격 생성' })
  async create(
    @Body() dto: CreateTerminalCrimpSpecDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.create(dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '압착 규격이 등록되었습니다.');
  }

  @Put(':specId')
  @ApiOperation({ summary: '압착 규격 수정' })
  async update(
    @Param('specId', ParseIntPipe) specId: number,
    @Body() dto: UpdateTerminalCrimpSpecDto,
    @Company() company: string,
    @Plant() plant: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.service.update(specId, dto, company, plant, req.user?.id ?? 'SYSTEM');
    return ResponseUtil.success(data, '압착 규격이 수정되었습니다.');
  }

  @Delete(':specId')
  @ApiOperation({ summary: '압착 규격 삭제' })
  async delete(@Param('specId', ParseIntPipe) specId: number, @Company() company: string, @Plant() plant: string) {
    await this.service.delete(specId, company, plant);
    return ResponseUtil.success(null, '압착 규격이 삭제되었습니다.');
  }
}
