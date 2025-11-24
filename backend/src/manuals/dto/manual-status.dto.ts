import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ManualSummaryDto {
  @ApiProperty({ example: 2 })
  fileCount!: number;

  @ApiProperty({ example: 128 })
  chunkCount!: number;

  @ApiProperty({ example: 64 })
  embeddedChunks!: number;

  @ApiProperty({ example: '2024-07-01T08:23:00.000Z' })
  updatedAt!: string;
}

export class ManualStatusResponseDto {
  @ApiProperty()
  hasManual!: boolean;

  @ApiPropertyOptional({ type: ManualSummaryDto })
  stats?: ManualSummaryDto;
}
