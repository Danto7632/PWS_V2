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

@ApiTags('Project Chats')
@Controller('api/projects/:projectId/chats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: '프로젝트 내 채팅 목록' })
  @ApiOkResponse({ type: ConversationSummaryDto, isArray: true })
  list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.conversationsService.listProjectChats(projectId, user.id);
  }

  @Post()
  @ApiOperation({ summary: '프로젝트 내 새 채팅 생성' })
  @ApiCreatedResponse({ type: ConversationDto })
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.createConversation(
      projectId,
      user.id,
      dto,
    );
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: '대화별 메시지 히스토리 조회' })
  @ApiOkResponse({ type: MessageResponseDto, isArray: true })
  getMessages(
    @Param('conversationId') conversationId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.conversationsService.getMessages(
      conversationId,
      projectId,
      user.id,
    );
  }

  @Patch(':conversationId')
  @ApiOperation({ summary: '채팅 제목 변경' })
  @ApiOkResponse({ type: ConversationDto })
  rename(
    @Param('conversationId') conversationId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: RenameConversationDto,
  ) {
    return this.conversationsService.renameConversation(
      conversationId,
      projectId,
      user.id,
      dto.title,
    );
  }

  @Delete(':conversationId')
  @ApiOperation({ summary: '채팅 삭제' })
  @ApiOkResponse({ description: '성공 시 { success: true } 반환' })
  remove(
    @Param('conversationId') conversationId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.conversationsService.deleteConversation(
      conversationId,
      projectId,
      user.id,
    );
    return { success: true };
  }
}
