import { Module } from '@nestjs/common';
import { GuestManualsController } from './guest-manuals.controller';
import { ManualsService } from './manuals.service';
@Module({
  imports: [],
  controllers: [GuestManualsController],
  providers: [ManualsService],
  exports: [ManualsService],
})
export class ManualsModule {}
