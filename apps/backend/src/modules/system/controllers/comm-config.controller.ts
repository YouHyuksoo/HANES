/**
 * @file src/modules/system/controllers/comm-config.controller.ts
 * @description 통신설정 API 엔드포인트
 *
 * 초보자 가이드:
 * 1. **GET /system/comm-configs**: 목록 조회 (필터+페이지네이션)
 * 2. **GET /system/comm-configs/type/:type**: 유형별 조회 (드롭다운용)
 * 3. **GET /system/comm-configs/name/:name**: 이름으로 조회 (참조용)
 * 4. **POST/PUT/DELETE**: CRUD
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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CommConfigService } from '../services/comm-config.service';
import {
  CreateCommConfigDto,
  UpdateCommConfigDto,
  CommConfigQueryDto,
} from '../dto/comm-config.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('시스템관리 - 통신설정')
@Controller('system/comm-configs')
export class CommConfigController {
  constructor(private readonly commConfigService: CommConfigService) {}

  @Get()
  @ApiOperation({ summary: '통신설정 목록 조회' })
  async findAll(@Query() query: CommConfigQueryDto) {
    const result = await this.commConfigService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('type/:type')
  @ApiOperation({ summary: '유형별 통신설정 조회 (드롭다운용)' })
  @ApiParam({ name: 'type', description: '통신 유형 (SERIAL, TCP, MQTT, OPC_UA, MODBUS)' })
  async findByType(@Param('type') type: string) {
    const data = await this.commConfigService.findByType(type);
    return ResponseUtil.success(data);
  }

  @Get('name/:name')
  @ApiOperation({ summary: '이름으로 통신설정 조회' })
  @ApiParam({ name: 'name', description: '설정 이름' })
  async findByName(@Param('name') name: string) {
    const data = await this.commConfigService.findByName(name);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: '통신설정 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.commConfigService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @ApiOperation({ summary: '통신설정 생성' })
  async create(@Body() dto: CreateCommConfigDto) {
    const data = await this.commConfigService.create(dto);
    return ResponseUtil.success(data, '통신설정이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '통신설정 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdateCommConfigDto) {
    const data = await this.commConfigService.update(id, dto);
    return ResponseUtil.success(data, '통신설정이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '통신설정 삭제' })
  async remove(@Param('id') id: string) {
    const data = await this.commConfigService.remove(id);
    return ResponseUtil.success(data);
  }
}
