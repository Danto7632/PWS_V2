import { ApiProperty } from '@nestjs/swagger';

export class ConversationSummaryDto {
  @ApiProperty({ description: '대화 ID' })
  id!: string;

  @ApiProperty({ description: '대화 제목' })
  title!: string;

  @ApiProperty({
    description: '생성 시각 ISO 문자열',
    example: '2024-01-01T12:00:00.000Z',
  })
  created_at!: string;

  @ApiProperty({
    description: '마지막 업데이트 시각 ISO 문자열',
    example: '2024-01-01T12:30:00.000Z',
  })
  updated_at!: string;
}

export class ConversationDto extends ConversationSummaryDto {
  @ApiProperty({
    description: '대화별 맞춤 지침 텍스트',
    nullable: true,
    required: false,
  })
  instruction_text?: string | null;
}
