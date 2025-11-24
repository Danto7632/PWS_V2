import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum LlmProvider {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  GEMINI = 'gemini',
}

export class ProviderConfigDto {
  @ApiProperty({
    enum: LlmProvider,
    description: 'LLM 공급자',
    example: LlmProvider.OLLAMA,
  })
  @IsEnum(LlmProvider)
  provider: LlmProvider;

  @ApiProperty({ description: '사용할 모델명', example: 'exaone3.5:2.4b-jetson' })
  @IsString()
  model: string;

  @ApiPropertyOptional({ description: 'OpenAI / Gemini 사용 시 필요한 API Key' })
  @IsOptional()
  @IsString()
  apiKey?: string;
}
