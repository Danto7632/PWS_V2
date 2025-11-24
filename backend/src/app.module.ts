import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { VectorStoreModule } from './vector-store/vector-store.module';
import { LlmModule } from './llm/llm.module';
import { ManualsModule } from './manuals/manuals.module';
import { SimulationsModule } from './simulations/simulations.module';
import { SystemModule } from './system/system.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    EmbeddingsModule,
    VectorStoreModule,
    LlmModule,
    ManualsModule,
    SimulationsModule,
    SystemModule,
    AuthModule,
    ConversationsModule,
  ],
})
export class AppModule {}
