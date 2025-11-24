import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ManualsService } from './manuals.service';
import { ManualIngestRequestDto } from './dto/manual-request.dto';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Manuals')
@Controller('api/manuals')
export class ManualsController {
  constructor(private readonly manualsService: ManualsService) {}

  @Post()
  @ApiOperation({ summary: '업무 매뉴얼 업로드 및 임베딩' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '업로드할 파일과 임베딩 비율을 전달합니다.',
    schema: {
      type: 'object',
      properties: {
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
      },
      required: ['embedRatio', 'files'],
    },
  })
  @UseInterceptors(FilesInterceptor('files'))
  ingestManuals(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: ManualIngestRequestDto,
  ) {
    return this.manualsService.ingest(files, body);
  }
}
