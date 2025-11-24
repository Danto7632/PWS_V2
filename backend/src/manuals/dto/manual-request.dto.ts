import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualIngestRequestDto {
  @ApiProperty({ description: 'Conversation identifier that owns the manuals' })
  @IsString()
  conversationId: string;

  @ApiProperty({
    description: '임베딩 학습 비율 (0.2 ~ 1.0)',
    minimum: 0.2,
    maximum: 1,
    default: 1,
    example: 0.8,
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
}
