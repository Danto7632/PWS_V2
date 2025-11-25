import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ description: '메시지 ID' })
  id!: string;

  @ApiProperty({ description: '연결된 대화 ID' })
  conversation_id!: string;

  @ApiProperty({
    description: '메시지 역할 (customer, employee 등)',
    example: 'customer',
  })
  role!: string;

  @ApiProperty({ description: '메시지 본문' })
  content!: string;

  @ApiProperty({
    description: '생성 시각 ISO 문자열',
    example: '2024-01-01T12:34:56.000Z',
  })
  created_at!: string;
}
