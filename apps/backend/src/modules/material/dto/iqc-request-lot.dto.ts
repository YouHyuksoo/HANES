import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';


export class IqcRequestLotLineInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  arrivalNo: string;

  @ApiProperty({ enum: ['SAMPLE', 'REPRESENTED'] })
  @IsString()
  @IsIn(['SAMPLE', 'REPRESENTED'])
  lineRole: 'SAMPLE' | 'REPRESENTED';
}

export class CreateIqcRequestLotDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sampleQty?: number;

  @ApiProperty({ type: [IqcRequestLotLineInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IqcRequestLotLineInputDto)
  lines: IqcRequestLotLineInputDto[];
}

export class IqcRequestLotQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class InspectIqcRequestLotDto {
  @ApiProperty({ enum: ['PASS', 'FAIL'] })
  @IsString()
  @IsIn(['PASS', 'FAIL'])
  result: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inspectorName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sampleQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inspectType?: string;
}
