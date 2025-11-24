import { Controller, Get, UseGuards } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('System')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/system')
export class SystemController {
  constructor(private readonly llmService: LlmService) {}

  @Get('ollama')
  getOllamaStatus(@CurrentUser() user: AuthUser) {
    void user;
    return this.llmService.getOllamaStatus();
  }
}
