import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

type ManualSummarySourceType = 'file' | 'instruction';

class ManualSummarySourceDto {
  @ApiProperty({ example: 'src_123' })
  id!: string;

  @ApiProperty({ example: 'file', enum: ['file', 'instruction'] })
  type!: ManualSummarySourceType;

  @ApiProperty({ example: 'sales-onboarding.pdf' })
  label!: string;

  @ApiProperty({ example: '2024-07-01T08:23:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '신입 영업 담당자 교육 매뉴얼...' })
  preview?: string;
}

class ManualSummaryDto {
  @ApiProperty({ example: 2 })
  fileCount!: number;

  @ApiProperty({ example: 128 })
  chunkCount!: number;

  @ApiProperty({ example: 64 })
  embeddedChunks!: number;

  @ApiProperty({ example: '2024-07-01T08:23:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ example: 0.8 })
  embedRatio!: number;

  @ApiProperty({ type: [ManualSummarySourceDto] })
  sources!: ManualSummarySourceDto[];
}

export class ManualStatusResponseDto {
  @ApiProperty()
  hasManual!: boolean;

  @ApiPropertyOptional({ type: ManualSummaryDto })
  stats?: ManualSummaryDto;
}
