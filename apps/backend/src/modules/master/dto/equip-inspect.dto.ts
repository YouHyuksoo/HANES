import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsIn, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class CreateEquipInspectItemDto {
  @ApiProperty({ description: '설비 코드' })
  @IsString()
  equipCode: string;

  @ApiProperty({ description: '점검항목 마스터 코드', example: 'EIP-001' })
  @IsString()
  @MaxLength(30)
  itemCode: string;

  @ApiProperty({ description: '점검 유형', enum: ['DAILY', 'PERIODIC', 'PM', 'WORKER'] })
  @IsString()
  @IsIn(['DAILY', 'PERIODIC', 'PM', 'WORKER'])
  inspectType: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional({ description: '표시 순서 (정렬용)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortSeq?: number;
}

export class EquipInspectItemQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '설비 코드 필터' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: '점검 유형 필터' })
  @IsOptional()
  @IsString()
  @IsIn(['DAILY', 'PERIODIC', 'PM', 'WORKER'])
  inspectType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
