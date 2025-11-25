import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ description: '프로젝트 이름', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ description: '설명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: '맞춤 지침 텍스트', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructionText?: string;
}
