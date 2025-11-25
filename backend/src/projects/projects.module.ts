import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ManualsModule } from '../manuals/manuals.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ManualsModule, AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
