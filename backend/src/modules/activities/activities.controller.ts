import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { AuthRequest, SessionGuard } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { ActivitiesService } from './activities.service';

export class DraftDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string | null;
  @IsOptional() @IsDateString({ strict: true }) @MaxLength(40) startAt?: string | null;
  @IsOptional() @IsDateString({ strict: true }) @MaxLength(40) endAt?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) location?: string | null;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(4294967295) capacity?: number | null;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsInt() @Min(0) @Max(2147483647) points?: number;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsBoolean() requiresCheckout?: boolean;
}
export class UpdateDraftDto extends DraftDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) revision!: string;
}
class AssigneeQuery { @IsOptional() @IsString() @MaxLength(100) search?: string; }

@Controller('activities') @UseGuards(SessionGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService, private readonly auth: AuthService) {}
  @Get('assignees') @Header('Cache-Control', 'no-store')
  assignees(@Req() request: AuthRequest, @Query() query: AssigneeQuery) { return this.activities.assignees(request.principal, query.search); }
  @Get(':id/editor') @Header('Cache-Control', 'no-store')
  read(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number) { return this.activities.read(request.principal, id); }
  @Post()
  create(@Req() request: AuthRequest, @Body() body: DraftDto) {
    this.auth.assertOrigin(request); return this.activities.save(request.principal, body);
  }
  @Patch(':id')
  update(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateDraftDto) {
    this.auth.assertOrigin(request); return this.activities.save(request.principal, body, id, body.revision);
  }
}
