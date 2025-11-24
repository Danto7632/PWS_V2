import { Module } from '@nestjs/common';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';
import { ManualsModule } from '../manuals/manuals.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { LlmModule } from '../llm/llm.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ManualsModule,
    VectorStoreModule,
    EmbeddingsModule,
    LlmModule,
    ConversationsModule,
    AuthModule,
  ],
  controllers: [SimulationsController],
  providers: [SimulationsService],
})
export class SimulationsModule {}
