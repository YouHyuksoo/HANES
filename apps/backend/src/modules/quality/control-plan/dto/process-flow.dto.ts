import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProcessFlowRowDto {
  @ApiProperty() @IsString() @MaxLength(30) processNo: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) processCode?: string;
  @ApiProperty() @IsString() @MaxLength(200) processName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) equipmentCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) equipmentName?: string;
  @ApiProperty({ enum: ['SUB', 'MAIN', 'OUTSOURCING'] }) @IsIn(['SUB', 'MAIN', 'OUTSOURCING']) lane: 'SUB' | 'MAIN' | 'OUTSOURCING';
  @ApiProperty({ enum: ['OPERATION','INSPECTION','TRANSPORT','STORAGE','DELAY','REWORK','QUARANTINE','SHIPPING'] })
  @IsIn(['OPERATION','INSPECTION','TRANSPORT','STORAGE','DELAY','REWORK','QUARANTINE','SHIPPING']) symbol: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) productSpecialCharacteristicCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) processSpecialCharacteristicCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
}

export class UpdateProcessFlowRowDto extends PartialType(CreateProcessFlowRowDto) {}

export class ReorderProcessFlowRowsDto {
  @ApiProperty({ type: [Number] }) @IsArray() @IsInt({ each: true }) rowIds: number[];
}
