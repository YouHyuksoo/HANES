/**
 * @file controllers/shelf-life-reinspect.controller.ts
 * @description 유수명자재 재검사 API
 */
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { ShelfLifeReInspectService } from '../services/shelf-life-reinspect.service';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

class ReInspectHistoryQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
  @ApiPropertyOptional() @IsOptional() @IsString() matUid?: string;
  @ApiPropertyOptional({ enum: ['PASS', 'FAIL'] }) @IsOptional() @IsString() @IsIn(['PASS', 'FAIL']) result?: string;
}

class CreateReInspectBodyDto {
  @ApiProperty() @IsString() matUid: string;
  @ApiPropertyOptional() @IsOptional() @IsString() inspectorName?: string;
  @ApiProperty({ enum: ['PASS', 'FAIL'] }) @IsString() @IsIn(['PASS', 'FAIL']) result: 'PASS' | 'FAIL';
  @ApiPropertyOptional({ description: '합격 시 연장일 (품목 최대연장일 이하)' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) extendDays?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) destructSampleQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() details?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() remark?: string;
}

@ApiTags('자재관리 - 유수명자재')
@Controller('material/shelf-life/reinspect')
export class ShelfLifeReInspectController {
  constructor(private readonly service: ShelfLifeReInspectService) {}

  @Get()
  @ApiOperation({ summary: '재검사 이력 조회' })
  async findAll(@Query() query: ReInspectHistoryQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @ApiOperation({ summary: '재검사 결과 등록' })
  async create(@Body() dto: CreateReInspectBodyDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.create(dto, company, plant);
    return ResponseUtil.success(result);
  }
}
