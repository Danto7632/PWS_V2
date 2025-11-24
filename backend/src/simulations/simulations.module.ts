import { Module } from '@nestjs/common';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';
import { ManualsModule } from '../manuals/manuals.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [ManualsModule, VectorStoreModule, EmbeddingsModule, LlmModule],
  controllers: [SimulationsController],
  providers: [SimulationsService],
})
export class SimulationsModule {}
