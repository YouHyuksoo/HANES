/**
 * @file controllers/vendor-barcode-mapping.controller.ts
 * @description 자재 제조사 바코드 매핑 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. CRUD 엔드포인트: GET/POST/PUT/DELETE /master/vendor-barcode-mappings
 * 2. 바코드 매칭: POST /master/vendor-barcode-mappings/resolve
 *    — 스캔한 바코드를 MES 품목으로 자동 변환
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { VendorBarcodeMappingService } from '../services/vendor-barcode-mapping.service';
import {
  CreateVendorBarcodeMappingDto,
  UpdateVendorBarcodeMappingDto,
  VendorBarcodeMappingQueryDto,
  BarcodeScanDto,
} from '../dto/vendor-barcode-mapping.dto';

@ApiTags('기준정보 - 제조사 바코드 매핑')
@Controller('master/vendor-barcode-mappings')
export class VendorBarcodeMappingController {
  constructor(
    private readonly service: VendorBarcodeMappingService,
  ) {}

  @Get()
  @ApiOperation({ summary: '매핑 목록 조회' })
  async findAll(@Query() query: VendorBarcodeMappingQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.service.findAll(query, company, plant);
    return ResponseUtil.paged(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '매핑 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '매핑 생성' })
  async create(@Body() dto: CreateVendorBarcodeMappingDto) {
    const data = await this.service.create(dto);
    return ResponseUtil.success(data, '바코드 매핑이 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '매핑 수정' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorBarcodeMappingDto,
  ) {
    const data = await this.service.update(id, dto);
    return ResponseUtil.success(data, '바코드 매핑이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '매핑 삭제' })
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return ResponseUtil.success(null, '바코드 매핑이 삭제되었습니다.');
  }

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '바코드 스캔 → 품목 매칭' })
  async resolveBarcode(@Body() dto: BarcodeScanDto) {
    const result = await this.service.resolveBarcode(dto.barcode);
    return ResponseUtil.success(result);
  }
}
