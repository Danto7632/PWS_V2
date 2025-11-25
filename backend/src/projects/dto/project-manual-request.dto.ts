import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ProjectManualRequestDto {
  @ApiProperty({
    description: '임베딩 학습 비율 (0.2 ~ 1.0)',
    minimum: 0.2,
    maximum: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.2)
  @Max(1)
  embedRatio: number;

  @ApiPropertyOptional({ description: 'Optional free-form instruction text' })
  @IsOptional()
  @IsString()
  instructionText?: string;

  @ApiPropertyOptional({
    description: 'append 또는 replace 모드',
    enum: ['append', 'replace'],
    default: 'append',
  })
  @IsOptional()
  @IsString()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';
}
