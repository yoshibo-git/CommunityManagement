import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAccountDto } from './accounts.dto';

export const accountImportLimit = 1024 * 1024;
const columns = ['username', 'password', 'name', 'email', 'faculty', 'role'] as const;
const labels = ['Tên đăng nhập', 'Mật khẩu tạm', 'Họ và tên', 'Email', 'Mã khoa', 'Vai trò'];
const headerError = () => new BadRequestException({
  code: 'VALIDATION_FAILED', message: 'Tệp phải có đúng 6 cột theo mẫu. PDF phải chứa bảng có đường kẻ và văn bản chọn được.',
});

export async function readAccountImport(file: { originalname: string; buffer: Buffer } | undefined) {
  if (!file?.buffer.length) throw headerError();
  let rows: unknown[][];
  try {
    if (/\.xlsx$/i.test(file.originalname) && file.buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))) {
      const { readSheet } = await import('read-excel-file/node');
      rows = await readSheet(file.buffer, { trim: false });
    } else if (/\.pdf$/i.test(file.originalname) && file.buffer.subarray(0, 5).toString() === '%PDF-') {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(file.buffer), isEvalSupported: false });
      try {
        const result = await parser.getTable({ first: 11 });
        if (result.total > 10) throw headerError();
        rows = result.pages.flatMap((page) => page.tables.flatMap((table) => table));
      } finally {
        await parser.destroy();
      }
    } else {
      throw headerError();
    }
  } catch {
    throw headerError();
  }
  const isHeader = (row: unknown[]) => row.length === columns.length && row.every((value, index) =>
    typeof value === 'string' && [columns[index], labels[index]].some((label) =>
      value.trim().toLocaleLowerCase('vi') === label.toLocaleLowerCase('vi')));
  const [header, ...data] = rows;
  if (!header || !isHeader(header)) throw headerError();
  const records = data.map((row, index) => ({ row, line: index + 2 })).filter(({ row }) =>
    !isHeader(row) && row.some((value) => value !== null && value !== undefined && value !== ''));
  if (!records.length || records.length > 25) {
    throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Tệp phải có từ 1 đến 25 tài khoản.' });
  }
  return records.map(({ row, line }) => {
    const input = plainToInstance(CreateAccountDto, Object.fromEntries(columns.map((column, index) => [
      column, typeof row[index] === 'string' ? (column === 'password' ? row[index] : row[index].trim()) : '',
    ])));
    if (String(input.role) === 'Người dùng') input.role = 'user';
    if (String(input.role) === 'Quản lý') input.role = 'staff';
    const errors = validateSync(input, { validationError: { target: false, value: false } }).map(({ property }) =>
      `${labels[columns.indexOf(property as typeof columns[number])]} không hợp lệ.`);
    if (row.length !== columns.length) errors.unshift('Dòng phải có đúng 6 cột.');
    return { line, input, errors };
  });
}
