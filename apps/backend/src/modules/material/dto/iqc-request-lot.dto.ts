import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';


export class IqcRequestLotLineInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  arrivalNo: string;

  @ApiProperty({ description: '입하 행 순번(MAT_ARRIVALS.SEQ). ARRIVAL_NO 단독으로는 입하 행이 유일하지 않다.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  arrivalSeq: number;

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
