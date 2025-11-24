import { Type } from 'class-transformer';
import { ValidateNested, IsString } from 'class-validator';
import { ProviderConfigDto } from '../../common/dto/provider-config.dto';
import { ApiProperty } from '@nestjs/swagger';

export class MessageRequestDto {
  @ApiProperty({ description: '대화 식별자' })
  @IsString()
  conversationId: string;

  @ApiProperty({
    description: '사용자 또는 AI가 발화한 메시지',
    example: '안녕하세요, 카드 재발급 문의드립니다.',
  })
  @IsString()
  message: string;

  @ApiProperty({ type: () => ProviderConfigDto })
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  providerConfig: ProviderConfigDto;
}
