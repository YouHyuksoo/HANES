import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePfmeaRowDto {
  @ApiProperty() @IsInt() processFlowRowId: number;
  @ApiProperty() @IsString() @MaxLength(500) processFunction: string;
  @ApiProperty() @IsString() @MaxLength(500) requirement: string;
  @ApiProperty() @IsString() @MaxLength(1000) potentialFailureMode: string;
  @ApiProperty() @IsString() @MaxLength(1000) potentialFailureEffect: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10) severity: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) specialCharacteristicCode?: string;
  @ApiProperty() @IsString() @MaxLength(1000) potentialCause: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) preventionControl?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10) occurrence: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) detectionControl?: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10) detection: number;
  @ApiPropertyOptional({ description: '서버 재계산 값' }) @IsOptional() @IsInt() rpn?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) recommendedAction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) responsibleOrganization?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) responsiblePerson?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) completedAction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() completionDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10) actionSeverity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10) actionOccurrence?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10) actionDetection?: number;
  @ApiPropertyOptional({ description: '서버 재계산 값' }) @IsOptional() @IsInt() actionRpn?: number;
}

export class UpdatePfmeaRowDto extends PartialType(CreatePfmeaRowDto) {}
