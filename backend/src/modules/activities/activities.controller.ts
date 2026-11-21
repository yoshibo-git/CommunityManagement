import { BadRequestException, Body, CallHandler, Controller, Delete, ExecutionContext, Get, Header, Injectable, NestInterceptor, Param, ParseIntPipe, Patch, Post, Query, Req, StreamableFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { IncomingMessage } from 'node:http';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AuthRequest, SessionGuard } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { ActivitiesService } from './activities.service';
import { activityImageLimit, type ActivityImageUpload } from './activity-image';

const draftUpload = FileFieldsInterceptor([{ name: 'image', maxCount: 1 }, { name: 'plan', maxCount: 1 }], { limits: { fileSize: activityImageLimit, fieldSize: 65536, fields: 1, files: 2, parts: 4 } });
type DraftFiles = { image?: ActivityImageUpload[]; plan?: ActivityImageUpload[] };
const isMultipart = (request: IncomingMessage) => request.headers['content-type']?.startsWith('multipart/form-data');

@Injectable()
class DraftPayload implements NestInterceptor {
  constructor(private readonly auth: AuthService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthRequest & { body: Record<string, unknown> }>();
    this.auth.assertOrigin(request, isMultipart(request) ? 'multipart/form-data' : 'application/json');
    if (isMultipart(request)) {
      try {
        const body: unknown = JSON.parse(typeof request.body?.draft === 'string' ? request.body.draft : '');
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        request.body = body as Record<string, unknown>;
      } catch { throw new BadRequestException(); }
    }
    return next.handle();
  }
}

class DraftAssignmentDto {
  @IsString() @Matches(/\S/) @MaxLength(255) name!: string;
  @IsInt() @Min(1) @Max(4294967295) userId!: number;
  @IsIn(['leader', 'member']) type!: 'leader' | 'member';
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
}

export class DraftDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsBoolean() publish?: boolean;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsBoolean() removePlan?: boolean;
  @IsOptional() @IsString() @MaxLength(4000) locationNote?: string | null;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => DraftAssignmentDto)
  assignments?: DraftAssignmentDto[];
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsBoolean() removeImage?: boolean;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray() @IsIn(['leader', 'member'], { each: true }) assignmentTypes?: ('leader' | 'member')[];
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
class AssigneeQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(['staff']) role?: 'staff';
}
class CancelActivityDto { @IsString() @Matches(/\S/) @MaxLength(1000) reason!: string; }
class PublishedDetailsDto {
  @IsString() @Matches(/\S/) @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) locationNote?: string | null;
  @IsString() @Matches(/^[a-f0-9]{64}$/) revision!: string;
}

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService, private readonly auth: AuthService) {}
  @Get('assignees') @UseGuards(SessionGuard) @Header('Cache-Control', 'no-store')
  assignees(@Req() request: AuthRequest, @Query() query: AssigneeQuery) { return this.activities.assignees(request.principal, query.search, query.role); }
  @Get(':id/editor') @UseGuards(SessionGuard) @Header('Cache-Control', 'no-store')
  read(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number) { return this.activities.read(request.principal, id); }
  @Get(':id/image') @Header('Cache-Control', 'no-store') @Header('X-Content-Type-Options', 'nosniff')
  async image(@Req() request: IncomingMessage, @Param('id', ParseIntPipe) id: number) {
    const { data, mime } = await this.activities.image(request, id);
    return new StreamableFile(data, { type: mime });
  }
  @Get(':id/plan') @UseGuards(SessionGuard) @Header('Cache-Control', 'no-store') @Header('X-Content-Type-Options', 'nosniff')
  async plan(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    const { data, extension, name } = await this.activities.plan(request.principal, id);
    const filename = encodeURIComponent(name ?? `ke-hoach-hoat-dong${extension}`).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16));
    return new StreamableFile(data, { type: 'application/octet-stream', disposition: `attachment; filename="ke-hoach-hoat-dong${extension}"; filename*=UTF-8''${filename}` });
  }
  @Post() @UseGuards(SessionGuard) @UseInterceptors(draftUpload, DraftPayload)
  create(@Req() request: AuthRequest, @Body() body: DraftDto, @UploadedFiles() files?: DraftFiles) {
    return this.activities.save(request.principal, body, undefined, undefined, files?.image?.[0], files?.plan?.[0]);
  }
  @Patch(':id') @UseGuards(SessionGuard) @UseInterceptors(draftUpload, DraftPayload)
  update(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateDraftDto, @UploadedFiles() files?: DraftFiles) {
    return this.activities.save(request.principal, body, id, body.revision, files?.image?.[0], files?.plan?.[0]);
  }
  @Post(':id/cancel') @UseGuards(SessionGuard)
  cancel(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() body: CancelActivityDto) {
    this.auth.assertOrigin(request);
    return this.activities.cancel(request.principal, id, body.reason.trim());
  }
  @Post(':id/tasks/:taskId/complete') @UseGuards(SessionGuard)
  completeTask(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Param('taskId', ParseIntPipe) taskId: number) {
    this.auth.assertOrigin(request);
    return this.activities.completeTask(request.principal, id, taskId);
  }
  @Patch(':id/published-details') @UseGuards(SessionGuard)
  updatePublishedDetails(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number, @Body() body: PublishedDetailsDto) {
    this.auth.assertOrigin(request);
    return this.activities.updatePublishedDetails(request.principal, id, body);
  }
  @Delete(':id') @UseGuards(SessionGuard)
  remove(@Req() request: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    this.auth.assertOrigin(request);
    return this.activities.removeDraft(request.principal, id);
  }
}
