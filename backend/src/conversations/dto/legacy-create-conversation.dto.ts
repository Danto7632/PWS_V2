import { IsOptional, IsString } from 'class-validator';

export class LegacyCreateConversationDto {
  @IsOptional()
  @IsString()
  title?: string;
}
