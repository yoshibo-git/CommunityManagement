import { ForbiddenException, HttpException, Injectable, OnModuleDestroy, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { createClient } from 'redis';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../common/security/password';
import type { TransactionContext } from '../../prisma/prisma.service';

export type Principal = { id: number; name: string; username: string; email: string; phone: string | null; faculty: string; role: 'user' | 'staff' | 'admin'; type: string | null; sessionProof?: string };
const roles = ['user', 'staff', 'admin'];

@Injectable()
export class AuthService implements OnModuleDestroy {
  private client?: ReturnType<typeof createClient>;
  private connecting?: Promise<unknown>;
  constructor(private readonly prisma: PrismaService) {}

  private async redis() {
    if (!process.env.REDIS_URL) throw new ServiceUnavailableException();
    if (!this.client) {
      this.client = createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true, socket: { connectTimeout: 3000, reconnectStrategy: false } });
      this.client.on('error', () => {});
    }
    try {
      if (!this.client.isReady) {
        if (!this.connecting) this.connecting = this.client.connect().finally(() => { this.connecting = undefined; });
        await this.connecting;
      }
      return this.client;
    } catch { throw new ServiceUnavailableException(); }
  }

  private key(sid: string) { return `cm:session:${createHash('sha256').update(sid).digest('hex')}`; }
  private fingerprint(user: { mat_khau: string; trang_thai: string; vai_tro: { ten_vai_tro: string }; thong_tin_sinh_trac: { id_khuon_mat: string } | null }) {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 64) throw new ServiceUnavailableException();
    return createHmac('sha256', secret).update(JSON.stringify([user.mat_khau, user.trang_thai, user.vai_tro.ten_vai_tro, user.thong_tin_sinh_trac?.id_khuon_mat ?? null])).digest('hex');
  }

  private async user(id: number) {
    return this.prisma.nguoi_dung.findUnique({ where: { id_nguoi_dung: id }, include: { vai_tro: true, khoa: true, thong_tin_sinh_trac: true } });
  }

  private publicUser(user: NonNullable<Awaited<ReturnType<AuthService['user']>>>): Principal {
    if (!roles.includes(user.vai_tro.ten_vai_tro) || user.trang_thai !== 'active') throw new UnauthorizedException();
    return { id: user.id_nguoi_dung, name: user.ho_ten, username: user.ten_dang_nhap, email: user.email, phone: user.so_dien_thoai, faculty: user.khoa?.ten_khoa ?? '', role: user.vai_tro.ten_vai_tro as Principal['role'], type: user.loai_nguoi_dung };
  }

  sid(request: IncomingMessage) {
    const value = request.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith('cm_sid='))?.slice(7);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  }

  assertOrigin(request: IncomingMessage) {
    const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    if (!request.headers.origin || !allowed.includes(request.headers.origin) || !request.headers['content-type']?.startsWith('application/json')) throw new ForbiddenException();
  }

  async login(username: string, password: string, address: string) {
    if (process.env.AUTH_PASSWORD_ONLY !== 'true' || process.env.NODE_ENV === 'production') throw new ServiceUnavailableException();
    const redis = await this.redis();
    const key = `cm:login:${createHash('sha256').update(username.toLocaleLowerCase()).digest('hex')}`;
    try {
      const networkKey = `cm:login-ip:${createHash('sha256').update(address).digest('hex')}`;
      const attempts = await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n", { keys: [networkKey], arguments: [] });
      if (Number(attempts) > 100) throw new HttpException({ code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }, 429);
      if (await redis.exists(`${key}:blocked`)) throw new HttpException({ code: 'LOGIN_TEMP_LOCKED', message: 'Đăng nhập tạm khóa. Vui lòng thử lại sau.' }, 429);
      const user = await this.prisma.nguoi_dung.findUnique({ where: { ten_dang_nhap: username }, include: { vai_tro: true, khoa: true, thong_tin_sinh_trac: true } });
      const valid = user ? await verifyPassword(password, user.mat_khau) : (await hashPassword(password), false);
      if (!valid || !user || user.trang_thai !== 'active' || !roles.includes(user.vai_tro.ten_vai_tro)) {
        await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; if n>=5 then redis.call('SET',KEYS[2],'1','EX',900) end; return n", { keys: [key, `${key}:blocked`], arguments: [] });
        throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
      }
      const current = await this.user(user.id_nguoi_dung);
      if (!current || current.mat_khau !== user.mat_khau) throw new UnauthorizedException();
      const principal = this.publicUser(current);
      const sid = randomBytes(32).toString('hex');
      await redis.set(this.key(sid), JSON.stringify({ userId: current.id_nguoi_dung, fingerprint: this.fingerprint(current) }), { EX: 1800 });
      return { sid, principal };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }

  async current(request: IncomingMessage, touch = false): Promise<Principal> {
    // Password-only sessions belong to the approved local stage and cannot cross into production.
    if (process.env.AUTH_PASSWORD_ONLY !== 'true' || process.env.NODE_ENV === 'production') throw new UnauthorizedException();
    const sid = this.sid(request);
    if (!sid) throw new UnauthorizedException();
    try {
      const redis = await this.redis();
      const raw = await redis.get(this.key(sid));
      if (!raw) throw new UnauthorizedException();
      const session = JSON.parse(raw) as { userId: number; fingerprint: string };
      if (!Number.isSafeInteger(session.userId) || session.userId <= 0) throw new UnauthorizedException();
      const user = await this.user(session.userId);
      if (!user || this.fingerprint(user) !== session.fingerprint || user.trang_thai !== 'active') {
        await redis.del(this.key(sid));
        throw new UnauthorizedException();
      }
      const principal = this.publicUser(user);
      Object.defineProperty(principal, 'sessionProof', { value: session.fingerprint });
      if (touch && !await redis.expire(this.key(sid), 1800)) throw new UnauthorizedException();
      return principal;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException();
    }
  }

  async logout(request: IncomingMessage) {
    const sid = this.sid(request);
    if (sid) {
      try { await (await this.redis()).del(this.key(sid)); } catch { throw new ServiceUnavailableException(); }
    }
  }

  async lockForWrite(tx: TransactionContext, principal: Principal, role: Principal['role']) {
    await tx.$queryRaw`SELECT id_nguoi_dung FROM nguoi_dung WHERE id_nguoi_dung = ${principal.id} FOR UPDATE`;
    const user = await tx.nguoi_dung.findUnique({ where: { id_nguoi_dung: principal.id }, include: { vai_tro: true, thong_tin_sinh_trac: true } });
    if (!user || user.trang_thai !== 'active' || this.fingerprint(user) !== principal.sessionProof) throw new UnauthorizedException();
    if (user.vai_tro.ten_vai_tro !== role) throw new ForbiddenException();
  }

  async onModuleDestroy() { if (this.client?.isOpen) await this.client.close(); }
}
