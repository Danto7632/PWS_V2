import { Module } from '@nestjs/common';
import { ManualsController } from './manuals.controller';
import { GuestManualsController } from './guest-manuals.controller';
import { ManualsService } from './manuals.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConversationsModule, AuthModule],
  controllers: [ManualsController, GuestManualsController],
  providers: [ManualsService],
  exports: [ManualsService],
})
export class ManualsModule {}
