import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectDto, ProjectSummaryDto } from './dto/project-response.dto';
import { ManualsService, ManualStatusPayload } from '../manuals/manuals.service';
import { ProjectManualRequestDto } from './dto/project-manual-request.dto';
import { ManualStatusResponseDto } from '../manuals/dto/manual-status.dto';

type ProjectRecord = {
  id: string;
  name: string;
  description?: string | null;
  instruction_text?: string | null;
  created_at: string;
  updated_at: string;
  chat_count?: number;
};

@ApiTags('Projects')
@Controller('api/projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly manualsService: ManualsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '프로젝트 목록 조회' })
  @ApiOkResponse({ type: ProjectSummaryDto, isArray: true })
  list(@CurrentUser() user: AuthUser): ProjectSummaryDto[] {
    const rows = this.projectsService.listProjects(user.id);
    return rows.map((row) => this.toProjectDto(row));
  }

  @Post()
  @ApiOperation({ summary: '새 프로젝트 생성' })
  @ApiOkResponse({ type: ProjectDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProjectDto,
  ): ProjectDto {
    return this.toProjectDto(this.projectsService.createProject(user.id, dto));
  }

  @Patch(':projectId')
  @ApiOperation({ summary: '프로젝트 정보 수정' })
  @ApiOkResponse({ type: ProjectDto })
  update(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProjectDto,
  ): ProjectDto {
    return this.toProjectDto(
      this.projectsService.updateProject(projectId, user.id, dto),
    );
  }

  @Delete(':projectId')
  @ApiOperation({ summary: '프로젝트 삭제' })
  async remove(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.getProjectOrThrow(projectId, user.id);
    await this.manualsService.deleteManualData(projectId);
    await this.projectsService.deleteProject(projectId, user.id);
    return { success: true };
  }

  @Post(':projectId/manuals')
  @ApiOperation({ summary: '프로젝트 매뉴얼 업로드' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '파일과 임베딩 설정을 업로드합니다.',
    type: ProjectManualRequestDto,
  })
  @UseInterceptors(FilesInterceptor('files'))
  async ingestManuals(
    @Param('projectId') projectId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: ProjectManualRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.getProjectOrThrow(projectId, user.id);
    return this.manualsService.ingestForProject(projectId, files, body);
  }

  @Get(':projectId/manuals/status')
  @ApiOperation({ summary: '프로젝트 매뉴얼 상태 조회' })
  @ApiOkResponse({ type: ManualStatusResponseDto })
  async manualStatus(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ManualStatusResponseDto> {
    await this.projectsService.getProjectOrThrow(projectId, user.id);
    const status: ManualStatusPayload =
      await this.manualsService.getManualStatus(projectId);
    return { hasManual: status.hasManual, stats: status.stats };
  }

  @Delete(':projectId/manuals/sources/:sourceId')
  @ApiOperation({ summary: '프로젝트 매뉴얼 자료 삭제' })
  async removeManualSource(
    @Param('projectId') projectId: string,
    @Param('sourceId') sourceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.projectsService.getProjectOrThrow(projectId, user.id);
    const status = await this.manualsService.removeSource(projectId, sourceId);
    return { hasManual: status.hasManual, stats: status.stats };
  }

  private toProjectDto(record: ProjectRecord): ProjectDto {
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? null,
      instruction_text: record.instruction_text ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
      chat_count: record.chat_count ?? 0,
    };
  }
}
