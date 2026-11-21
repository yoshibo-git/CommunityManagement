import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { AuthRequest, SessionGuard } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { WorkspaceService } from './workspace.service';
import { PublicContentService } from './public-content.service';

class FeedQuery {
  @IsOptional() @IsString() @MaxLength(255) search?: string;
  @IsOptional() @IsString() @MaxLength(80) cursor?: string;
}

class UpdateProfileDto {
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?(?=[\d ().-]*\d)[\d ().-]+$/)
  phone!: string | null;
}

@Controller()
export class SystemController {
  constructor(private readonly workspace: WorkspaceService, private readonly content: PublicContentService, private readonly auth: AuthService) {}
  @Get('system/workspace') @UseGuards(SessionGuard)
  read(@Req() request: AuthRequest) { return this.workspace.read(request.principal); }
  @Patch('users/me') @UseGuards(SessionGuard)
  updateProfile(@Req() request: AuthRequest, @Body() body: UpdateProfileDto) {
    this.auth.assertOrigin(request);
    return this.workspace.updatePhone(request.principal, body.phone);
  }
  @Get('notifications') @UseGuards(SessionGuard)
  async notifications(@Req() request: AuthRequest) { return { items: await this.workspace.notifications(request.principal.id) }; }
  @Get('posts/public')
  feed(@Query() query: FeedQuery) { return this.content.feed(query.search, query.cursor); }
  @Get('activities')
  activities() { return this.content.activities(); }
}
