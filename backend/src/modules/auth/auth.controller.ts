import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Post, Req, Res } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { IncomingMessage, ServerResponse } from 'node:http';
import { AuthService, Principal } from './auth.service';

class LoginDto {
  @IsString() @MinLength(1) @MaxLength(100) username!: string;
  @IsString() @MinLength(1) @MaxLength(1024) password!: string;
}
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
    response.setHeader('Set-Cookie', `cm_sid=${result.sid}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    response.setHeader('Cache-Control', 'no-store');
    return result.principal;
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
    response.setHeader('Set-Cookie', `cm_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return { success: true };
  }
}
