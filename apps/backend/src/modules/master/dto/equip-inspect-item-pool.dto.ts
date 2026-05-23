import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class CreateEquipInspectItemPoolDto {
  @ApiProperty({ description: '점검항목 코드', example: 'EIP-001' })
  @IsString()
  @MaxLength(30)
  itemCode: string;

  @ApiProperty({ description: '점검항목명', example: '에어압력 확인' })
  @IsString()
  @MaxLength(200)
  itemName: string;

  @ApiProperty({ description: '점검유형', enum: ['DAILY', 'PERIODIC', 'PM', 'WORKER'] })
  @IsString()
  @IsIn(['DAILY', 'PERIODIC', 'PM', 'WORKER'])
  inspectType: string;

  @ApiPropertyOptional({ description: '판정기준' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  criteria?: string;

  @ApiPropertyOptional({ description: '주기', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cycle?: string;

  @ApiPropertyOptional({ description: '사용여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class UpdateEquipInspectItemPoolDto extends PartialType(CreateEquipInspectItemPoolDto) {}

export class EquipInspectItemPoolQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '점검유형' })
  @IsOptional()
  @IsString()
  @IsIn(['DAILY', 'PERIODIC', 'PM', 'WORKER'])
  inspectType?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
