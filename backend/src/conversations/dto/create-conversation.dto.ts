import { IsIn, IsOptional, IsString } from 'class-validator';

export type ConversationRole = 'customer' | 'employee';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsIn(['customer', 'employee'])
  role: ConversationRole;
}
