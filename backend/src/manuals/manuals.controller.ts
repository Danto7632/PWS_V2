import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ManualsService } from './manuals.service';
import { ManualIngestRequestDto } from './dto/manual-request.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';

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
}
