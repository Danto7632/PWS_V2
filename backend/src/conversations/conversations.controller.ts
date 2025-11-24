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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ConversationDto,
  ConversationSummaryDto,
} from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';

@ApiTags('Conversations')
@Controller('api/conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: '내 대화 목록 조회' })
  @ApiOkResponse({ type: ConversationSummaryDto, isArray: true })
  list(@CurrentUser() user: AuthUser) {
    return this.conversationsService.listConversations(user.id);
  }

  @Post()
  @ApiOperation({ summary: '새 대화 생성' })
  @ApiCreatedResponse({ type: ConversationDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.conversationsService.createConversation(user.id, dto.title);
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: '대화별 메시지 히스토리 조회' })
  @ApiOkResponse({ type: MessageResponseDto, isArray: true })
  getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.conversationsService.getMessages(conversationId, user.id);
  }

  @Patch(':conversationId')
  @ApiOperation({ summary: '대화 제목 변경' })
  @ApiOkResponse({ type: ConversationDto })
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
  @ApiOperation({ summary: '대화별 맞춤 지침 텍스트 업데이트' })
  @ApiOkResponse({ type: ConversationDto })
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
  @ApiOperation({ summary: '대화 삭제' })
  @ApiOkResponse({ description: '성공 시 { success: true } 반환' })
  remove(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.conversationsService.deleteConversation(conversationId, user.id);
    return { success: true };
  }
}
