import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthRequest, SessionGuard } from '../auth/auth.controller';
import { WorkspaceService } from './workspace.service';
import { PublicContentService } from './public-content.service';

class FeedQuery {
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @IsString() @MaxLength(80) cursor?: string;
}

@Controller()
export class SystemController {
  constructor(private readonly workspace: WorkspaceService, private readonly content: PublicContentService) {}
  @Get('system/workspace') @UseGuards(SessionGuard)
  read(@Req() request: AuthRequest) { return this.workspace.read(request.principal); }
  @Get('notifications') @UseGuards(SessionGuard)
  async notifications(@Req() request: AuthRequest) { return { items: await this.workspace.notifications(request.principal.id) }; }
  @Get('posts/public')
  feed(@Query() query: FeedQuery) { return this.content.feed(query.search, query.cursor); }
  @Get('activities')
  activities() { return this.content.activities(); }
}
