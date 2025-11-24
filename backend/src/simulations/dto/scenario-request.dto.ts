import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import { ProviderConfigDto } from '../../common/dto/provider-config.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ScenarioRequestDto {
  @ApiProperty({ description: '대화 식별자' })
  @IsString()
  conversationId: string;

  @ApiProperty({ type: () => ProviderConfigDto })
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  providerConfig: ProviderConfigDto;
}
