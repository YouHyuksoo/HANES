/**
 * @file src/modules/system/controllers/comm-config.controller.ts
 * @description 통신설정 API 엔드포인트 + 시리얼 통신 테스트
 *
 * 초보자 가이드:
 * 1. **GET /system/comm-configs**: 목록 조회 (필터+페이지네이션)
 * 2. **GET /system/comm-configs/serial-ports**: 시스템 시리얼 포트 목록
 * 3. **POST /system/comm-configs/:id/test-serial**: 시리얼 통신 테스트
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
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CommConfigService } from '../services/comm-config.service';
import { SerialTestService } from '../services/serial-test.service';
import {
  CreateCommConfigDto,
  UpdateCommConfigDto,
  CommConfigQueryDto,
} from '../dto/comm-config.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('시스템관리 - 통신설정')
@Controller('system/comm-configs')
export class CommConfigController {
  constructor(
    private readonly commConfigService: CommConfigService,
    private readonly serialTestService: SerialTestService,
  ) {}

  @Get()
  @ApiOperation({ summary: '통신설정 목록 조회' })
  async findAll(@Query() query: CommConfigQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.commConfigService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('serial-ports')
  @ApiOperation({ summary: '시스템 시리얼 포트 목록 조회' })
  async listSerialPorts() {
    const data = await this.serialTestService.listPorts();
    return ResponseUtil.success(data);
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
