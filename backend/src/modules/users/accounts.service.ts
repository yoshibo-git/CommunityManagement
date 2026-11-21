import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { hashPassword } from '../../common/security/password';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService, type Principal } from '../auth/auth.service';
import type { AccountsQuery, CreateAccountDto, UpdateAccountDto } from './accounts.dto';

const accountSelect = {
  id_nguoi_dung: true, ten_dang_nhap: true, ho_ten: true, email: true, so_dien_thoai: true,
  trang_thai: true, loai_nguoi_dung: true, id_khoa: true,
  khoa: { select: { ten_khoa: true } }, vai_tro: { select: { ten_vai_tro: true } },
} satisfies Prisma.nguoi_dungSelect;
const pageSize = 10;

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  faculties() {
    return this.prisma.khoa.findMany({ select: { id_khoa: true, ten_khoa: true }, orderBy: { ten_khoa: 'asc' } });
  }

  async create(principal: Principal, input: CreateAccountDto) {
    const [account] = await this.createAccounts(principal, [input]);
    return account;
  }

  assertLocalProvisioning() {
    if (process.env.NODE_ENV !== 'development' || process.env.AUTH_PASSWORD_ONLY !== 'true') throw new ServiceUnavailableException();
  }

  async createAccounts(principal: Principal, inputs: CreateAccountDto[]) {
    this.assertLocalProvisioning();
    if (inputs.some(({ role }) => role === 'user') && process.env.FACE_ENROLLMENT_DEMO !== 'true') throw new ServiceUnavailableException();
    const entries: { input: CreateAccountDto; passwordHash: string }[] = [];
    for (const input of inputs) entries.push({ input, passwordHash: await hashPassword(input.password) });
    try {
      return await this.prisma.runInTransaction(async (tx) => {
        await this.auth.lockForWrite(tx, principal, 'admin');
        const accounts: Prisma.nguoi_dungGetPayload<{ select: typeof accountSelect }>[] = [];
        for (const { input, passwordHash } of entries) {
          const facultyId = input.faculty?.trim();
          const faculty = facultyId ? await tx.khoa.findUnique({ where: { id_khoa: facultyId }, select: { id_khoa: true } }) : null;
          const role = await tx.vai_tro.findUnique({ where: { ten_vai_tro: input.role }, select: { id_vai_tro: true } });
          if ((facultyId && !faculty) || !role) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Khoa hoặc vai trò không hợp lệ.' });
          const student = input.role === 'user';
          accounts.push(await tx.nguoi_dung.create({
            select: accountSelect,
            data: {
              ten_dang_nhap: input.username, mat_khau: passwordHash, ho_ten: input.name.trim(), email: input.email,
              id_khoa: faculty?.id_khoa ?? null, id_vai_tro: role.id_vai_tro, loai_nguoi_dung: student ? 'student' : 'staff',
              trang_thai: student ? 'pending_faceio' : 'active',
            },
          }));
        }
        return accounts;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'DUPLICATE', message: 'Tên đăng nhập hoặc email đã được sử dụng.' });
      }
      throw error;
    }
  }

  async inspectImport(inputs: CreateAccountDto[]) {
    const [faculties, existing] = await Promise.all([
      this.faculties(),
      this.prisma.nguoi_dung.findMany({
        where: { OR: [{ ten_dang_nhap: { in: inputs.map(({ username }) => username) } }, { email: { in: inputs.map(({ email }) => email) } }] },
        select: { ten_dang_nhap: true, email: true },
      }),
    ]);
    const key = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const invalid = (value: string, index: number, values: string[]) => values.some((item, position) => position !== index && key(item) === key(value));
    const usernames = inputs.map(({ username }) => username);
    const emails = inputs.map(({ email }) => email);
    return inputs.map((input, index) => {
      const errors: string[] = [];
      const faculty = input.faculty;
      if (faculty && !faculties.some(({ id_khoa }) => key(id_khoa) === key(faculty))) errors.push('Mã khoa không hợp lệ.');
      if (invalid(input.username, index, usernames) || existing.some(({ ten_dang_nhap }) => key(ten_dang_nhap) === key(input.username))) errors.push('Tên đăng nhập bị trùng.');
      if (invalid(input.email, index, emails) || existing.some(({ email }) => key(email) === key(input.email))) errors.push('Email bị trùng.');
      if (input.role === 'user' && process.env.FACE_ENROLLMENT_DEMO !== 'true') errors.push('Chưa bật đăng ký khuôn mặt.');
      return errors;
    });
  }

  list(query: AccountsQuery) {
    const search = query.search?.trim();
    const id = search && /^\d{1,10}$/.test(search) ? Number(search) : 0;
    const where: Prisma.nguoi_dungWhereInput = {
      ...(search && { OR: [
        { ho_ten: { contains: search } }, { ten_dang_nhap: { contains: search } }, { email: { contains: search } },
        ...(id > 0 && id <= 4294967295 ? [{ id_nguoi_dung: id }] : []),
      ] }),
      ...(query.role && { vai_tro: { ten_vai_tro: query.role } }),
      ...(query.status && { trang_thai: query.status }),
      ...(query.type && { loai_nguoi_dung: query.type }),
      ...(query.faculty && { id_khoa: query.faculty }),
    };
    const field = { id: 'id_nguoi_dung', name: 'ho_ten', username: 'ten_dang_nhap', email: 'email' } as const;
    const page = Number(query.page ?? 1);
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.nguoi_dung.count({ where });
      const items = await tx.nguoi_dung.findMany({
        where, select: accountSelect, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: [{ [field[query.sort ?? 'id']]: query.direction ?? 'asc' }, { id_nguoi_dung: 'asc' }],
      });
      return { items, total, page, pageSize };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async detail(id: number) {
    const account = await this.prisma.nguoi_dung.findUnique({ where: { id_nguoi_dung: id }, select: accountSelect });
    if (!account) throw new NotFoundException();
    return account;
  }

  async update(principal: Principal, id: number, body: UpdateAccountDto) {
    try {
      return await this.prisma.runInTransaction(async (tx) => {
        await this.auth.lockForWrite(tx, principal, 'admin');
        await tx.$queryRaw`SELECT id_nguoi_dung FROM nguoi_dung WHERE id_nguoi_dung = ${id} FOR UPDATE`;
        const where = { id_nguoi_dung: id };
        const account = await tx.nguoi_dung.findUnique({ where, select: { email: true, trang_thai: true } });
        if (!account) throw new NotFoundException();
        if (account.trang_thai === 'pending_activation' && account.email !== body.email) {
          throw new ConflictException({ code: 'STATE_CONFLICT', message: 'Chưa thể đổi email của tài khoản đang chờ kích hoạt.' });
        }
        const faculty = body.faculty === undefined ? undefined : await tx.khoa.findUnique({
          where: { id_khoa: body.faculty.trim() }, select: { id_khoa: true },
        });
        if (faculty === null) throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Khoa không hợp lệ.' });
        return tx.nguoi_dung.update({
          where, select: accountSelect, data: {
            ho_ten: body.name.trim(), email: body.email, so_dien_thoai: body.phone,
            ...(faculty && { id_khoa: faculty.id_khoa }),
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'DUPLICATE', message: 'Email đã được sử dụng.' });
      }
      throw error;
    }
  }
}
