import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateQualityPlanParticipantDto {
  @ApiProperty() @IsString() @MaxLength(100) userName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) organization?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) userId?: string;
}
