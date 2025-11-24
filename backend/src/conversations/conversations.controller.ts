import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { RenameConversationDto } from './dto/rename-conversation.dto';
import { UpdateInstructionDto } from './dto/update-instruction.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Conversations')
@Controller('api/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.conversationsService.listConversations(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.conversationsService.createConversation(user.id, dto.title);
  }

  @Get(':conversationId/messages')
  getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.conversationsService.getMessages(conversationId, user.id);
  }

  @Patch(':conversationId')
  rename(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RenameConversationDto,
  ) {
    return this.conversationsService.renameConversation(
      conversationId,
      user.id,
      dto.title,
    );
  }

  @Patch(':conversationId/instruction')
  updateInstruction(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateInstructionDto,
  ) {
    return this.conversationsService.updateInstruction(
      conversationId,
      user.id,
      dto.instructionText,
    );
  }

  @Delete(':conversationId')
  remove(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.conversationsService.deleteConversation(conversationId, user.id);
    return { success: true };
  }
}
