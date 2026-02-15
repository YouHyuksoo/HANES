/**
 * @file src/modules/master/controllers/label-template.controller.ts
 * @description 라벨 템플릿 컨트롤러 - CRUD API 엔드포인트
 *
 * API:
 * - GET    /api/v1/master/label-templates      : 목록 조회
 * - GET    /api/v1/master/label-templates/:id   : 단건 조회
 * - POST   /api/v1/master/label-templates       : 생성
 * - PUT    /api/v1/master/label-templates/:id   : 수정
 * - DELETE /api/v1/master/label-templates/:id   : 삭제
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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { LabelTemplateService } from '../services/label-template.service';
import {
  CreateLabelTemplateDto,
  UpdateLabelTemplateDto,
  LabelTemplateQueryDto,
} from '../dto/label-template.dto';

@ApiTags('기준정보 - 라벨 템플릿')
@Controller('master/label-templates')
export class LabelTemplateController {
  constructor(
    private readonly labelTemplateService: LabelTemplateService,
  ) {}

  @Get()
  @ApiOperation({ summary: '라벨 템플릿 목록 조회' })
  async findAll(@Query() query: LabelTemplateQueryDto) {
    const result = await this.labelTemplateService.findAll(query);
    return ResponseUtil.paged(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '라벨 템플릿 단건 조회' })
  @ApiParam({ name: 'id', description: '라벨 템플릿 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.labelTemplateService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '라벨 템플릿 생성' })
  async create(@Body() dto: CreateLabelTemplateDto) {
    const data = await this.labelTemplateService.create(dto);
    return ResponseUtil.success(data, '라벨 템플릿이 저장되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '라벨 템플릿 수정' })
  @ApiParam({ name: 'id', description: '라벨 템플릿 ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLabelTemplateDto,
  ) {
    const data = await this.labelTemplateService.update(id, dto);
    return ResponseUtil.success(data, '라벨 템플릿이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '라벨 템플릿 삭제' })
  @ApiParam({ name: 'id', description: '라벨 템플릿 ID' })
  async delete(@Param('id') id: string) {
    await this.labelTemplateService.delete(id);
    return ResponseUtil.success(null, '라벨 템플릿이 삭제되었습니다.');
  }
}
