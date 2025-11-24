import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProviderConfigDto,
  LlmProvider,
} from '../common/dto/provider-config.dto';
import ollama from 'ollama';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly configService: ConfigService) {}

  async call(prompt: string, config: ProviderConfigDto): Promise<string> {
    switch (config.provider) {
      case LlmProvider.OLLAMA:
        return this.callOllama(prompt, config);
      case LlmProvider.OPENAI:
        return this.callOpenAI(prompt, config);
      case LlmProvider.GEMINI:
        return this.callGemini(prompt, config);
      default:
        throw new InternalServerErrorException('Unsupported LLM provider');
    }
  }

  async getOllamaStatus() {
    try {
      const { models } = await ollama.list();
      return {
        connected: true,
        models: models.map((m) => m.name),
      };
    } catch (error) {
      this.logger.warn(
        `Ollama status check failed: ${(error as Error).message}`,
      );
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  private async callOllama(prompt: string, config: ProviderConfigDto) {
    const response = await ollama.chat({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.message.content.trim();
  }

  private async callOpenAI(prompt: string, config: ProviderConfigDto) {
    const apiKey =
      config.apiKey || this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('Missing OpenAI API key');
    }
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content?.trim() ?? '';
  }

  private async callGemini(prompt: string, config: ProviderConfigDto) {
    const apiKey =
      config.apiKey || this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('Missing Gemini API key');
    }
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: config.model });
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    return text?.trim() ?? '';
  }
}
