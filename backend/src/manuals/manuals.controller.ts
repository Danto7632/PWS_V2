import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ManualsService, ManualStatusPayload } from './manuals.service';
import { ManualIngestRequestDto } from './dto/manual-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { ManualStatusResponseDto } from './dto/manual-status.dto';

@ApiTags('Manuals')
@Controller('api/manuals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ManualsController {
  constructor(private readonly manualsService: ManualsService) {}

  @Post()
  @ApiOperation({ summary: '업무 매뉴얼 업로드 및 임베딩' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      '업로드할 파일, 대화 ID, 임베딩 비율, 선택적 지침을 전달합니다.',
    schema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: '대화 식별자',
        },
        embedRatio: {
          type: 'number',
          minimum: 0.2,
          maximum: 1,
          default: 1,
          description: '파일 임베딩 학습 수준 (0.2 ~ 1)',
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'PDF, TXT, Excel 파일 목록',
        },
        instructionText: {
          type: 'string',
          description: '파일 대신 업로드할 선택적 지침 텍스트',
        },
      },
      required: ['conversationId', 'embedRatio'],
    },
  })
  @UseInterceptors(FilesInterceptor('files'))
  ingestManuals(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: ManualIngestRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.manualsService.ingest(files, body, user);
  }

  @Get(':conversationId/status')
  @ApiOperation({ summary: '대화의 매뉴얼 학습 상태 조회' })
  @ApiOkResponse({ type: ManualStatusResponseDto })
  async getStatus(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ManualStatusResponseDto> {
    const status: ManualStatusPayload =
      await this.manualsService.getManualStatusForUser(conversationId, user);
    return {
      hasManual: status.hasManual,
      stats: status.stats,
    };
  }

  @Delete(':conversationId/sources/:sourceId')
  @ApiOperation({ summary: '업로드한 자료 하나를 삭제하고 벡터 스토어를 재구성합니다.' })
  @ApiOkResponse({ type: ManualStatusResponseDto })
  async removeSource(
    @Param('conversationId') conversationId: string,
    @Param('sourceId') sourceId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ManualStatusResponseDto> {
    const status = await this.manualsService.removeSourceForConversation(
      conversationId,
      sourceId,
      user,
    );
    return {
      hasManual: status.hasManual,
      stats: status.stats,
    };
  }
}
