import { ApiProperty } from '@nestjs/swagger';

export class ProjectSummaryDto {
  @ApiProperty({ description: '프로젝트 ID' })
  id: string;

  @ApiProperty({ description: '이름' })
  name: string;

  @ApiProperty({ description: '설명', required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ description: '맞춤 지침', required: false, nullable: true })
  instruction_text?: string | null;

  @ApiProperty({ description: '생성 시각 (ISO8601)' })
  created_at: string;

  @ApiProperty({ description: '업데이트 시각 (ISO8601)' })
  updated_at: string;

  @ApiProperty({ description: '보유한 채팅 수' })
  chat_count: number;
}

export class ProjectDto extends ProjectSummaryDto {}
