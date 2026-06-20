import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class HarnessCircuitSpecDto {
  @ApiProperty({ description: '회로 번호', example: '1' })
  @IsString()
  @MaxLength(50)
  circuitNo: string;

  @ApiPropertyOptional({ description: '전선 규격', example: 'VSF 0.75SQ' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  wireSpec?: string;

  @ApiPropertyOptional({ description: 'BOM 전선 품목 코드', example: 'WIRE-VSF-075-BL' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  wireItemCode?: string;

  @ApiPropertyOptional({ description: '전선 크기', example: '26' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  wireSize?: string;

  @ApiPropertyOptional({ description: '색상 코드', example: 'BL' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  colorCode?: string;

  @ApiPropertyOptional({ description: '색상명', example: '파랑' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  colorName?: string;

  @ApiPropertyOptional({ description: '전선 길이(mm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lengthMm?: number;

  @ApiPropertyOptional({ description: 'A측 탈피 길이(mm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stripA?: number;

  @ApiPropertyOptional({ description: 'B측 탈피 길이(mm)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stripB?: number;

  @ApiPropertyOptional({ description: 'A측 하우징' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  endAHousing?: string;

  @ApiPropertyOptional({ description: 'A측 터미널' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  endATerminal?: string;

  @ApiPropertyOptional({ description: '연결 표시' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  connectionSymbol?: string;

  @ApiPropertyOptional({ description: 'B측 터미널' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  endBTerminal?: string;

  @ApiPropertyOptional({ description: 'B측 하우징' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  endBHousing?: string;

  @ApiPropertyOptional({ description: '튜브 사양' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tubeSpec?: string;

  @ApiPropertyOptional({ description: '서브 번호' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  subNo?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remark?: string;
}

export class CreateProductionSpecificationDto {
  @ApiProperty({ description: '도면 번호', example: 'DWG-HNS-001' })
  @IsString()
  @MaxLength(100)
  drawingNo: string;

  @ApiProperty({ description: '품목 코드', example: 'HNS02' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiPropertyOptional({ description: 'ERP 품번' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  erpItemNo?: string;

  @ApiPropertyOptional({ description: '고객사 품번' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerPartNo?: string;

  @ApiPropertyOptional({ description: '최초 Revision', default: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  revisionCode?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remark?: string;

  @ApiPropertyOptional({ description: '회로 사양', type: [HarnessCircuitSpecDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HarnessCircuitSpecDto)
  circuits?: HarnessCircuitSpecDto[];
}

export class UpdateProductionSpecificationDto extends PartialType(CreateProductionSpecificationDto) {}

export class UpdateProductionSpecificationRevisionDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'APPROVED', 'OBSOLETE'] })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'APPROVED', 'OBSOLETE'])
  status?: 'DRAFT' | 'APPROVED' | 'OBSOLETE';

  @ApiPropertyOptional({ description: '변경 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeReason?: string;

  @ApiPropertyOptional({ description: '회로 사양', type: [HarnessCircuitSpecDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HarnessCircuitSpecDto)
  circuits?: HarnessCircuitSpecDto[];
}

export class ReviseProductionSpecificationDto {
  @ApiPropertyOptional({ description: '변경 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  changeReason?: string;
}

export class ProductionSpecificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '품목 코드' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '상태' })
  @IsOptional()
  @IsString()
  status?: string;
}
