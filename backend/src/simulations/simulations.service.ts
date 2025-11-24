import { Injectable } from '@nestjs/common';
import { ManualsService } from '../manuals/manuals.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { LlmService } from '../llm/llm.service';
import { ProviderConfigDto } from '../common/dto/provider-config.dto';
import { AuthUser } from '../auth/auth.types';
import { ConversationsService } from '../conversations/conversations.service';

export interface Scenario {
  situation: string;
  customerType: string;
  firstMessage: string;
}

@Injectable()
export class SimulationsService {
  constructor(
    private readonly manualsService: ManualsService,
    private readonly vectorStore: VectorStoreService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly llmService: LlmService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async generateScenario(
    conversationId: string,
    providerConfig: ProviderConfigDto,
    user?: AuthUser | null,
  ): Promise<Scenario> {
    if (user) {
      this.conversationsService.getConversationOrThrow(conversationId, user.id);
    }
    const manual = await this.manualsService.getManualOrThrow(conversationId);
    const prompt = `당신은 아래 매뉴얼에 나오는 서비스/업무의 고객 또는 사용자입니다.

[업무/서비스 매뉴얼 발췌]
${manual.manualText.slice(0, 1500)}

위 매뉴얼의 주제와 용어를 벗어나지 말고, 실제 현장에서 자주 나올 법한 고객 문의 상황 1개만 만드세요.

[출력 형식 - 반드시 준수]
상황: (고객이 처한 상황)
고객 유형: (예: 일반 고객 / 초보 학습자 등)
고객 첫 말: (직원에게 처음 건네는 한 문장)`;

    const response = await this.llmService.call(prompt, providerConfig);
    const scenario = parseScenario(response);
    if (scenario.firstMessage && user) {
      this.conversationsService.appendMessage(
        conversationId,
        'customer',
        scenario.firstMessage,
        user.id,
      );
    }
    return scenario;
  }

  async customerRespond(
    conversationId: string,
    message: string,
    providerConfig: ProviderConfigDto,
    user?: AuthUser | null,
  ) {
    if (user) {
      this.conversationsService.getConversationOrThrow(conversationId, user.id);
      this.conversationsService.appendMessage(
        conversationId,
        'customer',
        message,
        user.id,
      );
    }
    const manual = await this.manualsService.getManualOrThrow(conversationId);
    const context = await this.buildContext(conversationId, message);
    const contextText = context.join('\n');
    const prompt = `다음 업무 매뉴얼을 참고하여 고객 문의에 전문적이고 친절하게 응답해주세요:

업무 매뉴얼:
${contextText || manual.manualText.slice(0, 1200)}

고객 문의: ${message}

친절하고 정확한 직원 응답 (100자 이내):`;

    const aiResponse = (
      await this.llmService.call(prompt, providerConfig)
    ).trim();
    if (user) {
      this.conversationsService.appendMessage(
        conversationId,
        'employee',
        aiResponse,
      );
    }
    return {
      aiResponse,
      context,
    };
  }

  async employeeRespond(
    conversationId: string,
    message: string,
    providerConfig: ProviderConfigDto,
    user?: AuthUser | null,
  ) {
    if (user) {
      this.conversationsService.getConversationOrThrow(conversationId, user.id);
      this.conversationsService.appendMessage(
        conversationId,
        'employee',
        message,
        user.id,
      );
    }
    const manual = await this.manualsService.getManualOrThrow(conversationId);
    const context = await this.buildContext(conversationId, message);
    const contextText = context.join('\n');
    const prompt = `다음 업무 매뉴얼을 기준으로 직원의 고객 응답을 평가해주세요:

업무 매뉴얼:
${contextText || manual.manualText.slice(0, 1200)}

직원 응답: ${message}

다음 기준으로 평가해주세요:
1. 정확성 (1-5점)
2. 친절성 (1-5점)
3. 적절성 (1-5점)
총점: /15점

형식:
정확성: X/5 - 간단한 코멘트
친절성: X/5 - 간단한 코멘트
적절성: X/5 - 간단한 코멘트
총점: X/15
개선점: 구체적인 개선 제안`;

    const evaluationRaw = await this.llmService.call(prompt, providerConfig);
    const { score, maxScore } = parseScore(evaluationRaw);
    const nextScenario = await this.generateScenario(
      conversationId,
      providerConfig,
      user,
    );

    return {
      evaluation: {
        feedback: evaluationRaw,
        score,
        maxScore,
      },
      nextScenario,
      nextCustomerMessage: nextScenario.firstMessage,
      context,
    };
  }

  private async buildContext(
    conversationId: string,
    query: string,
  ): Promise<string[]> {
    const embedding = await this.embeddingsService.embed(query);
    if (!embedding.length) {
      return [];
    }
    const docs = this.vectorStore.queryByEmbedding(
      conversationId,
      embedding,
      3,
    );
    return docs.map((doc) => doc.content);
  }
}

function parseScenario(raw: string): Scenario {
  const fallback: Scenario = {
    situation: '매뉴얼 기반 일반 문의 상황',
    customerType: '일반 고객',
    firstMessage: '안녕하세요, 매뉴얼 내용 관련해 문의드립니다.',
  };
  if (!raw) {
    return fallback;
  }
  const lines = raw.split('\n').map((line) => line.trim());
  const scenario: Scenario = { ...fallback };
  for (const line of lines) {
    if (line.startsWith('상황:')) {
      scenario.situation = line.split('상황:')[1].trim();
    } else if (line.startsWith('고객 유형:')) {
      scenario.customerType = line.split('고객 유형:')[1].trim();
    } else if (line.startsWith('고객 첫 말:') || line.startsWith('첫 말:')) {
      scenario.firstMessage = line.split(':')[1].trim().replace(/["“”]/g, '');
    }
  }
  return scenario;
}

function parseScore(raw: string) {
  const match = raw.match(/총점:\s*(\d+)\s*\/\s*(\d+)/);
  if (!match) {
    return { score: 0, maxScore: 15 };
  }
  return {
    score: Number(match[1]),
    maxScore: Number(match[2]),
  };
}
