import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ProviderConfigDto } from '../../common/dto/provider-config.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ScenarioRequestDto {
  @ApiProperty({ type: () => ProviderConfigDto })
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  providerConfig: ProviderConfigDto;
}
