import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateQualityRevisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) changeReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() changeDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() refPfdRevisionId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() refPfmeaRevisionId?: number;
}

export class CreateQualityRevisionDto {
  @ApiProperty() @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(1000) changeReason: string;
  @ApiProperty() @IsString() @IsNotEmpty() @Matches(/\S/) changeDescription: string;
}
