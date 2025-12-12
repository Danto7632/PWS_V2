import { Module } from '@nestjs/common';
import { GuestManualsController } from './guest-manuals.controller';
import { ManualsService } from './manuals.service';
import { ManualsController } from './manuals.controller';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [AuthModule],
  controllers: [GuestManualsController, ManualsController],
  providers: [ManualsService],
  exports: [ManualsService],
})
export class ManualsModule {}
