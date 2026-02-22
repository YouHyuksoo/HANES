/**
 * @file controllers/sys-config.controller.ts
 * @description 시스템 환경설정 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET /: 전체 설정 목록 (관리 페이지용, 그룹별)
 * 2. GET /active: 활성 설정 key-value 맵 (앱 로딩 시 호출)
 * 3. POST /: 신규 설정 등록
 * 4. PATCH /:id: 설정 수정
 * 5. PUT /bulk: 여러 설정 일괄 저장
 * 6. DELETE /:id: 설정 삭제
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SysConfigService } from '../services/sys-config.service';
import {
  CreateSysConfigDto,
  UpdateSysConfigDto,
  BulkUpdateSysConfigDto,
  SysConfigQueryDto,
} from '../dto/sys-config.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('시스템관리 - 환경설정')
@Controller('system/configs')
export class SysConfigController {
  constructor(private readonly sysConfigService: SysConfigService) {}

  @Get()
  @ApiOperation({ summary: '환경설정 목록 조회' })
  async findAll(@Query() query: SysConfigQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.sysConfigService.findAll(query, company, plant);
    return ResponseUtil.success(result);
  }

  @Get('active')
  @ApiOperation({ summary: '활성 설정 맵 조회 (앱 로딩용)' })
  async findAllActive() {
    const result = await this.sysConfigService.findAllActive();
    return ResponseUtil.success(result);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '환경설정 등록' })
  async create(@Body() dto: CreateSysConfigDto) {
    const data = await this.sysConfigService.create(dto);
    return ResponseUtil.success(data, '설정이 등록되었습니다.');
  }

  @Patch(':id')
  @ApiOperation({ summary: '환경설정 수정' })
  @ApiParam({ name: 'id', description: '설정 ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateSysConfigDto) {
    const data = await this.sysConfigService.update(id, dto);
    return ResponseUtil.success(data, '설정이 수정되었습니다.');
  }

  @Put('bulk')
  @ApiOperation({ summary: '환경설정 일괄 저장' })
  async bulkUpdate(@Body() dto: BulkUpdateSysConfigDto) {
    const data = await this.sysConfigService.bulkUpdate(dto);
    return ResponseUtil.success(data, '설정이 저장되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '환경설정 삭제' })
  @ApiParam({ name: 'id', description: '설정 ID' })
  async remove(@Param('id') id: string) {
    const data = await this.sysConfigService.remove(id);
    return ResponseUtil.success(data, '설정이 삭제되었습니다.');
  }
}
