import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
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

  @ApiPropertyOptional({ description: '설비유형 (COM_CODES EQUIP_TYPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipType?: string;

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

  @ApiPropertyOptional({ description: '판정구분 (VISUAL 판정형 | MEASURE 측정형)', default: 'VISUAL' })
  @IsOptional()
  @IsString()
  @IsIn(['VISUAL', 'MEASURE'])
  itemType?: string;

  @ApiPropertyOptional({ description: '측정 단위 (측정형만)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '하한값 (측정형만)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lslValue?: number;

  @ApiPropertyOptional({ description: '상한값 (측정형만)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  uslValue?: number;

  @ApiPropertyOptional({ description: '작업자점검 QR 코드값 (INSPECT_TYPE=WORKER 항목에만 사용)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerQrCode?: string;

  @ApiPropertyOptional({ description: '점검항목 사진 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

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

  @ApiPropertyOptional({ description: '설비유형 (COM_CODES EQUIP_TYPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipType?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
