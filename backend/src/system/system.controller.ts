import { Controller, Get } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';

@Controller('api/system')
export class SystemController {
  constructor(private readonly llmService: LlmService) {}

  @Get('ollama')
  getOllamaStatus() {
    return this.llmService.getOllamaStatus();
  }
}
