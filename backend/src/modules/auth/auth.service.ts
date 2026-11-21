import { BadRequestException, ForbiddenException, HttpException, Injectable, OnModuleDestroy, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { createClient } from 'redis';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../common/security/password';
import type { TransactionContext } from '../../prisma/prisma.service';
import { createEncryptedFaceTemplate, matchesFaceTemplate } from './face-enrollment';

export type Principal = { id: number; name: string; username: string; email: string; phone: string | null; faculty: string; role: 'user' | 'staff' | 'admin'; type: string | null; sessionProof?: string };
const roles = ['user', 'staff', 'admin'];
const enrollmentTtl = 300;
type FacePurpose = 'enroll' | 'verify';

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

  assertOrigin(request: IncomingMessage, contentType = 'application/json') {
    const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    if (!request.headers.origin || !allowed.includes(request.headers.origin) || !request.headers['content-type']?.startsWith(contentType)) throw new ForbiddenException();
  }

  private faceTicketKey(ticket: string) {
    return `cm:face-ticket:${createHash('sha256').update(ticket).digest('hex')}`;
  }

  private async issueSession(user: NonNullable<Awaited<ReturnType<AuthService['user']>>>, faceVerified = false) {
    const principal = this.publicUser(user);
    const sid = randomBytes(32).toString('hex');
    await (await this.redis()).set(this.key(sid), JSON.stringify({ userId: user.id_nguoi_dung, fingerprint: this.fingerprint(user), ...(faceVerified ? { faceVerified } : {}) }), { EX: 1800 });
    return { sid, principal };
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
      if (process.env.FACE_ENROLLMENT_DEMO === 'true' && principal.role === 'user') {
        if (principal.type !== 'student') throw new UnauthorizedException();
        if (current.thong_tin_sinh_trac && !current.thong_tin_sinh_trac.mau_khuon_mat) throw new ServiceUnavailableException();
        const purpose: FacePurpose = current.thong_tin_sinh_trac ? 'verify' : 'enroll';
        const ticket = randomBytes(32).toString('hex');
        const expiresAt = Date.now() + enrollmentTtl * 1000;
        await redis.set(this.faceTicketKey(ticket), JSON.stringify({
          userId: current.id_nguoi_dung, fingerprint: this.fingerprint(current), expiresAt, attempts: 0, purpose,
        }), { EX: enrollmentTtl });
        return { step: purpose === 'enroll' ? 'face_enrollment_required' : 'face_verification_required', ticket, expiresIn: enrollmentTtl };
      }
      return await this.issueSession(current);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }

  async completeFaceStep(ticket: string, image: Buffer, purpose: FacePurpose) {
    if (process.env.NODE_ENV !== 'development' || process.env.FACE_ENROLLMENT_DEMO !== 'true' ||
      !/^[a-f0-9]{64}$/.test(ticket)) throw new UnauthorizedException();
    const redis = await this.redis();
    const key = this.faceTicketKey(ticket);
    const claim = await redis.eval(`
      local raw = redis.call('GET', KEYS[1])
      if not raw then return false end
      local record = cjson.decode(raw)
      if record.busy or record.purpose ~= ARGV[1] then return false end
      if record.attempts >= 5 then return 'limit' end
      record.busy = true
      record.attempts = record.attempts + 1
      local next = cjson.encode(record)
      redis.call('SET', KEYS[1], next, 'KEEPTTL')
      return next
    `, { keys: [key], arguments: [purpose] }).catch(() => { throw new ServiceUnavailableException(); });
    if (claim === 'limit') throw new HttpException({ code: 'RATE_LIMITED', message: 'Đã hết lượt chụp. Vui lòng đăng nhập lại.' }, 429);
    if (typeof claim !== 'string') throw new UnauthorizedException();
    const state = JSON.parse(claim) as { userId: number; fingerprint: string; expiresAt: number };
    const check = (user: Parameters<AuthService['fingerprint']>[0] & { loai_nguoi_dung: string | null }) => {
      if (Date.now() >= state.expiresAt || user.trang_thai !== 'active' ||
        user.vai_tro.ten_vai_tro !== 'user' || user.loai_nguoi_dung !== 'student' ||
        this.fingerprint(user) !== state.fingerprint ||
        Boolean(user.thong_tin_sinh_trac) !== (purpose === 'verify')) throw new UnauthorizedException();
    };
    try {
      const current = await this.user(state.userId);
      if (!current) throw new UnauthorizedException();
      check(current);
      if (purpose === 'verify') {
        const saved = current.thong_tin_sinh_trac;
        if (!saved) throw new UnauthorizedException();
        if (!await matchesFaceTemplate(image, state.userId, saved.id_khuon_mat, saved.mau_khuon_mat)) {
          throw new BadRequestException({ code: 'FACE_NOT_MATCHED', message: 'Khuôn mặt không khớp. Vui lòng chụp lại.' });
        }
        const verified = await this.user(state.userId);
        if (!verified) throw new UnauthorizedException();
        check(verified);
        if (!await redis.del(key)) throw new UnauthorizedException();
        return await this.issueSession(verified, true);
      }
      const faceId = randomUUID();
      const template = await createEncryptedFaceTemplate(image, state.userId, faceId);
      await this.prisma.runInTransaction(async (tx) => {
        await tx.$queryRaw`SELECT id_nguoi_dung FROM nguoi_dung WHERE id_nguoi_dung = ${state.userId} FOR UPDATE`;
        const user = await tx.nguoi_dung.findUnique({ where: { id_nguoi_dung: state.userId }, include: { vai_tro: true, thong_tin_sinh_trac: true } });
        if (!user) throw new UnauthorizedException();
        check(user);
        await tx.thong_tin_sinh_trac.create({ data: {
          id_nguoi_dung: state.userId, id_khuon_mat: faceId, mau_khuon_mat: template, ngay_dang_ky: new Date(),
        } });
      });
      if (!await redis.del(key)) throw new UnauthorizedException();
      return { registered: true as const };
    } catch (error) {
      await redis.eval(`
        local raw = redis.call('GET', KEYS[1])
        if raw ~= ARGV[1] then return end
        local record = cjson.decode(raw)
        record.busy = nil
        redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL')
      `, { keys: [key], arguments: [claim] }).catch(() => undefined);
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
      const session = JSON.parse(raw) as { userId: number; fingerprint: string; faceVerified?: boolean };
      if (!Number.isSafeInteger(session.userId) || session.userId <= 0) throw new UnauthorizedException();
      const user = await this.user(session.userId);
      if (!user || this.fingerprint(user) !== session.fingerprint || user.trang_thai !== 'active' ||
        (process.env.FACE_ENROLLMENT_DEMO === 'true' && user.vai_tro.ten_vai_tro === 'user' &&
          (user.loai_nguoi_dung !== 'student' || !user.thong_tin_sinh_trac?.mau_khuon_mat || session.faceVerified !== true))) {
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

  async changePassword(principal: Principal, { currentPassword, newPassword, confirmPassword }: {
    currentPassword: string; newPassword: string; confirmPassword: string;
  }) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException({ code: 'PASSWORD_MISMATCH', message: 'Mật khẩu xác nhận không trùng với mật khẩu mới.' });
    }
    if ([...newPassword].length < 8 || newPassword === currentPassword) {
      throw new BadRequestException({ code: 'PASSWORD_POLICY', message: 'Mật khẩu mới phải khác mật khẩu hiện tại và có ít nhất 8 ký tự.' });
    }
    const user = await this.user(principal.id);
    if (!user || this.fingerprint(user) !== principal.sessionProof) throw new UnauthorizedException();
    if (!await verifyPassword(currentPassword, user.mat_khau)) {
      throw new BadRequestException({ code: 'CURRENT_PASSWORD_INVALID', message: 'Mật khẩu hiện tại không đúng.' });
    }
    const hash = await hashPassword(newPassword);
    await this.prisma.runInTransaction(async (tx) => {
      await this.lockForWrite(tx, principal, principal.role);
      await tx.nguoi_dung.update({ where: { id_nguoi_dung: principal.id }, data: { mat_khau: hash } });
    });
  }

  async lockForWrite(tx: TransactionContext, principal: Principal, role: Principal['role']) {
    await tx.$queryRaw`SELECT id_nguoi_dung FROM nguoi_dung WHERE id_nguoi_dung = ${principal.id} FOR UPDATE`;
    const user = await tx.nguoi_dung.findUnique({ where: { id_nguoi_dung: principal.id }, include: { vai_tro: true, thong_tin_sinh_trac: true } });
    if (!user || user.trang_thai !== 'active' || this.fingerprint(user) !== principal.sessionProof) throw new UnauthorizedException();
    if (user.vai_tro.ten_vai_tro !== role) throw new ForbiddenException();
  }

  async onModuleDestroy() { if (this.client?.isOpen) await this.client.close(); }
}
