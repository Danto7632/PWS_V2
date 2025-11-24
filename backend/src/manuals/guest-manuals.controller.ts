import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ManualsService } from './manuals.service';
import { ManualIngestRequestDto } from './dto/manual-request.dto';

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
}
