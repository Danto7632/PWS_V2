import { IsString } from 'class-validator';

export class RenameConversationDto {
  @IsString()
  title: string;
}
