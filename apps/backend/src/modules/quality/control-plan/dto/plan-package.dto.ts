import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePlanPackageDto {
  @ApiProperty({ maxLength: 50 }) @IsString() @MaxLength(50) itemCode: string;
  @ApiProperty({ enum: ['PROTOTYPE', 'PRE_LAUNCH', 'PRODUCTION'] })
  @IsIn(['PROTOTYPE', 'PRE_LAUNCH', 'PRODUCTION']) phase: 'PROTOTYPE' | 'PRE_LAUNCH' | 'PRODUCTION';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) projectCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) projectName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) customerCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) partNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) organization?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) keyContact?: string;
}

export class UpdatePlanPackageDto extends PartialType(CreatePlanPackageDto) {}

export class CreatePlanOutputEventDto {
  @ApiProperty({ enum: ['PREVIEWED', 'PDF_DOWNLOADED', 'PRINTED', 'EXCEL_DOWNLOADED'] })
  @IsIn(['PREVIEWED', 'PDF_DOWNLOADED', 'PRINTED', 'EXCEL_DOWNLOADED'])
  eventType: 'PREVIEWED' | 'PDF_DOWNLOADED' | 'PRINTED' | 'EXCEL_DOWNLOADED';
  @ApiPropertyOptional({ enum: ['PFD', 'PFMEA', 'CONTROL_PLAN', 'HISTORY', 'WORKBOOK'] })
  @IsOptional() @IsIn(['PFD', 'PFMEA', 'CONTROL_PLAN', 'HISTORY', 'WORKBOOK']) documentType?: string;
}
