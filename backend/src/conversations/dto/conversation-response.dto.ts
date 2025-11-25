import { ApiProperty } from '@nestjs/swagger';

export class ConversationSummaryDto {
  @ApiProperty({ description: '대화 ID' })
  id!: string;

  @ApiProperty({ description: '대화 제목' })
  title!: string;

  @ApiProperty({ description: '소속 프로젝트 ID' })
  project_id!: string;

  @ApiProperty({ description: '채팅 고정 역할', enum: ['customer', 'employee'] })
  role!: 'customer' | 'employee';

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

export class ConversationDto extends ConversationSummaryDto {}
