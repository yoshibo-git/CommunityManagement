import { BadRequestException, Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Post, Req, Res, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { IncomingMessage, ServerResponse } from 'node:http';
import { AuthService, Principal } from './auth.service';
import { maxFaceImageBytes } from './face-enrollment';

class LoginDto {
  @IsString() @MinLength(1) @MaxLength(100) username!: string;
  @IsString() @MinLength(1) @MaxLength(1024) password!: string;
}
class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(1024) currentPassword!: string;
  @IsString() @MaxLength(1024) newPassword!: string;
  @IsString() @MaxLength(1024) confirmPassword!: string;
}
const faceUpload = FileInterceptor('image', { limits: { fileSize: maxFaceImageBytes, files: 1, fields: 0, parts: 2 } });
export type AuthRequest = IncomingMessage & { principal: Principal };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.principal = await this.auth.current(request, request.headers['x-user-activity'] === '1');
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login/password')
  async login(@Body() body: LoginDto, @Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse) {
    this.auth.assertOrigin(request);
    // shortcut: rate limiting uses the proxy peer IP, configure trusted proxies before exposing this stage beyond local development.
    const result = await this.auth.login(body.username, body.password, request.socket.remoteAddress ?? 'unknown');
    response.setHeader('Cache-Control', 'no-store');
    if ('step' in result) return result;
    this.setSessionCookie(response, result.sid);
    return result.principal;
  }
  @Post('face/enroll')
  @UseInterceptors(faceUpload)
  async enrollFace(@UploadedFile() image: { buffer: Buffer } | undefined, @Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse) {
    const { ticket, bytes } = this.readFaceUpload(request, image);
    const result = await this.auth.completeFaceStep(ticket, bytes, 'enroll');
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }
  @Post('login/face')
  @UseInterceptors(faceUpload)
  async verifyFace(@UploadedFile() image: { buffer: Buffer } | undefined, @Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse) {
    const { ticket, bytes } = this.readFaceUpload(request, image);
    const result = await this.auth.completeFaceStep(ticket, bytes, 'verify');
    if (!('sid' in result)) throw new UnauthorizedException();
    response.setHeader('Cache-Control', 'no-store');
    this.setSessionCookie(response, result.sid);
    return result.principal;
  }
  private readFaceUpload(request: IncomingMessage, image: { buffer: Buffer } | undefined) {
    this.auth.assertOrigin(request, 'multipart/form-data');
    if (!image?.buffer.length) throw new BadRequestException({ code: 'FACE_IMAGE_INVALID', message: 'Vui lòng chụp một ảnh khuôn mặt.' });
    const ticket = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] ?? '';
    return { ticket, bytes: image.buffer };
  }
  @Post('password/change')
  @UseGuards(SessionGuard)
  async changePassword(@Body() body: ChangePasswordDto, @Req() request: AuthRequest, @Res({ passthrough: true }) response: ServerResponse) {
    this.auth.assertOrigin(request);
    await this.auth.changePassword(request.principal, body);
    response.setHeader('Cache-Control', 'no-store');
    this.clearSessionCookie(response);
    return { changed: true };
  }
  private setSessionCookie(response: ServerResponse, sid: string) {
    response.setHeader('Set-Cookie', `cm_sid=${sid}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }
  @Get('session')
  async session(@Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse) {
    response.setHeader('Cache-Control', 'no-store');
    return this.auth.current(request);
  }
  @Post('logout')
  async logout(@Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse) {
    this.auth.assertOrigin(request);
    await this.auth.logout(request);
    this.clearSessionCookie(response);
    return { success: true };
  }
  private clearSessionCookie(response: ServerResponse) {
    response.setHeader('Set-Cookie', `cm_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }
}
