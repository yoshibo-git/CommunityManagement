import { Module } from '@nestjs/common';
import { AppController } from './app/app.controller';
import { PrismaService } from './prisma/prisma.service';
import { AuthController, SessionGuard } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { SystemController } from './modules/system/system.controller';
import { WorkspaceService } from './modules/system/workspace.service';
import { PublicContentService } from './modules/system/public-content.service';
import { ActivitiesController } from './modules/activities/activities.controller';
import { ActivitiesService } from './modules/activities/activities.service';
import { AccountsController } from './modules/users/accounts.controller';
import { AccountsService } from './modules/users/accounts.service';

@Module({
  imports: [],
  controllers: [AppController, AuthController, SystemController, ActivitiesController, AccountsController],
  providers: [PrismaService, AuthService, SessionGuard, WorkspaceService, PublicContentService, ActivitiesService, AccountsService],
})
export class AppModule {}
