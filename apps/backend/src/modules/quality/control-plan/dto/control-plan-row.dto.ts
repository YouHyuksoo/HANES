import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateControlPlanRowDto {
  @ApiProperty() @IsInt() processFlowRowId: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() pfmeaRowId?: number | null;
  @ApiPropertyOptional({ description: '서버가 PFD 값으로 대체' }) @IsOptional() @IsString() processNo?: string;
  @ApiPropertyOptional({ description: '서버가 PFD 값으로 대체' }) @IsOptional() @IsString() processName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) equipmentCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) equipmentName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) characteristicNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) productCharacteristic?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) processCharacteristic?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) specialCharacteristicCode?: string;
  @ApiProperty() @IsString() @MaxLength(1000) specification: string;
  @ApiProperty() @IsString() @MaxLength(500) evaluationMethod: string;
  @ApiProperty() @IsString() @MaxLength(50) sampleSize: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) sampleFrequency?: string;
  @ApiProperty() @IsString() @MaxLength(1000) controlMethod: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) responsibleRole?: string;
  @ApiProperty() @IsString() @MaxLength(2000) reactionPlan: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) recordForm?: string;
}

export class UpdateControlPlanRowDto extends PartialType(CreateControlPlanRowDto) {}
