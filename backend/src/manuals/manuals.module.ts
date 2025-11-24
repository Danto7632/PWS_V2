import { Module } from '@nestjs/common';
import { ManualsController } from './manuals.controller';
import { ManualsService } from './manuals.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConversationsModule, AuthModule],
  controllers: [ManualsController],
  providers: [ManualsService],
  exports: [ManualsService],
})
export class ManualsModule {}
