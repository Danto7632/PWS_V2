import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ManualsService, ManualStatusPayload } from './manuals.service';
import { ManualIngestRequestDto } from './dto/manual-request.dto';
import { ManualStatusResponseDto } from './dto/manual-status.dto';

@ApiTags('Guest Manuals')
@Controller('api/guest/manuals')
export class GuestManualsController {
  constructor(private readonly manualsService: ManualsService) {}

  @Post()
  @ApiOperation({ summary: '인증 없이 임시 세션으로 매뉴얼 업로드' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '게스트 세션의 대화 ID와 매뉴얼 파일을 업로드합니다.',
    schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', description: '임시 세션 식별자' },
        embedRatio: {
          type: 'number',
          minimum: 0.2,
          maximum: 1,
          default: 1,
          description: '파일 임베딩 학습 수준 (0.2 ~ 1)',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'PDF, TXT, Excel 파일 목록',
        },
        instructionText: {
          type: 'string',
          description: '업로드 대신 사용할 지침 텍스트',
        },
      },
      required: ['conversationId', 'embedRatio'],
    },
  })
  @UseInterceptors(FilesInterceptor('files'))
  ingest(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: ManualIngestRequestDto,
  ) {
    return this.manualsService.ingest(files, body);
  }

  @Get(':conversationId/status')
  @ApiOperation({ summary: '게스트 세션용 매뉴얼 학습 상태 조회' })
  @ApiOkResponse({ type: ManualStatusResponseDto })
  async status(
    @Param('conversationId') conversationId: string,
  ): Promise<ManualStatusResponseDto> {
    const status: ManualStatusPayload =
      await this.manualsService.getManualStatus(conversationId);
    return {
      hasManual: status.hasManual,
      stats: status.stats,
    };
  }

  @Delete(':conversationId/sources/:sourceId')
  @ApiOperation({ summary: '게스트 세션 자료 삭제 및 재구성' })
  @ApiOkResponse({ type: ManualStatusResponseDto })
  async removeSource(
    @Param('conversationId') conversationId: string,
    @Param('sourceId') sourceId: string,
  ): Promise<ManualStatusResponseDto> {
    const status = await this.manualsService.removeSource(
      conversationId,
      sourceId,
    );
    return {
      hasManual: status.hasManual,
      stats: status.stats,
    };
  }
}
