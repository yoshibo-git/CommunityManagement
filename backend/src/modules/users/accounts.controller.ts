import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, NotFoundException, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthRequest, SessionGuard } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { AccountsQuery, CreateAccountDto, UpdateAccountDto } from './accounts.dto';
import { AccountsService } from './accounts.service';
import { accountImportLimit, readAccountImport } from './account-import';

const importFile = FileInterceptor('file', { limits: { fileSize: accountImportLimit, files: 1, fields: 0 } });
type AccountImportFile = Parameters<typeof readAccountImport>[0];

function assertAdmin(request: AuthRequest) {
  if (request.principal.role !== 'admin') throw new ForbiddenException();
}

function accountId(raw: string) {
  const id = Number(raw);
  if (!/^[1-9]\d{0,9}$/.test(raw) || id > 4294967295) throw new NotFoundException();
  return id;
}

@Controller('users')
@UseGuards(SessionGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService, private readonly auth: AuthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest, @Query() query: AccountsQuery) {
    assertAdmin(request);
    return this.accounts.list(query);
  }

  @Get('faculties')
  @Header('Cache-Control', 'no-store')
  faculties(@Req() request: AuthRequest) {
    assertAdmin(request);
    return this.accounts.faculties();
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Req() request: AuthRequest, @Body() body: CreateAccountDto) {
    assertAdmin(request);
    this.auth.assertOrigin(request);
    return this.accounts.create(request.principal, body);
  }

  @Post('import/preview')
  @UseInterceptors(importFile)
  @Header('Cache-Control', 'no-store')
  async preview(@Req() request: AuthRequest, @UploadedFile() file: AccountImportFile) {
    const rows = await this.validateImport(request, file);
    return { items: rows.map(({ line, input, errors }) => ({
      line, username: input.username, name: input.name, email: input.email, faculty: input.faculty, role: input.role, errors,
    })) };
  }

  @Post('import/commit')
  @UseInterceptors(importFile)
  @Header('Cache-Control', 'no-store')
  async commit(@Req() request: AuthRequest, @UploadedFile() file: AccountImportFile) {
    const rows = await this.validateImport(request, file);
    if (rows.some(({ errors }) => errors.length)) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Tệp có dòng lỗi. Vui lòng kiểm tra lại trước khi nhập.' });
    }
    const accounts = await this.accounts.createAccounts(request.principal, rows.map(({ input }) => input));
    return { created: accounts.length };
  }

  private async validateImport(request: AuthRequest, file: AccountImportFile) {
    assertAdmin(request);
    this.auth.assertOrigin(request, 'multipart/form-data');
    this.accounts.assertLocalProvisioning();
    const rows = await readAccountImport(file);
    const errors = await this.accounts.inspectImport(rows.map(({ input }) => input));
    return rows.map((row, index) => ({ ...row, errors: [...row.errors, ...errors[index]] }));
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Req() request: AuthRequest, @Param('id') rawId: string) {
    assertAdmin(request);
    return this.accounts.detail(accountId(rawId));
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(@Req() request: AuthRequest, @Param('id') rawId: string, @Body() body: UpdateAccountDto) {
    assertAdmin(request);
    this.auth.assertOrigin(request);
    return this.accounts.update(request.principal, accountId(rawId), body);
  }
}
