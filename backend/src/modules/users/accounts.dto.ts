import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const roles = ['user', 'staff', 'admin'];
const statuses = ['pending_activation', 'pending_faceio', 'active', 'locked'];

export class AccountsQuery {
  @IsOptional() @IsString() @MaxLength(150) search?: string;
  @IsOptional() @IsIn(roles) role?: string;
  @IsOptional() @IsIn(statuses) status?: string;
  @IsOptional() @IsString() @MaxLength(30) type?: string;
  @IsOptional() @IsString() @MaxLength(20) faculty?: string;
  @IsOptional() @Matches(/^[1-9]\d{0,8}$/) page?: string;
  @IsOptional() @IsIn(['id', 'name', 'username', 'email']) sort?: 'id' | 'name' | 'username' | 'email';
  @IsOptional() @IsIn(['asc', 'desc']) direction?: 'asc' | 'desc';
}

export class UpdateAccountDto {
  @IsString() @Matches(/\S/) @MaxLength(150) name!: string;
  @IsEmail() @MaxLength(150) email!: string;
  @ValidateIf((_object, value) => value !== null)
  @IsString() @MaxLength(20) @Matches(/^\+?(?=[\d ().-]*\d)[\d ().-]+$/) phone!: string | null;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString() @Matches(/\S/) @MaxLength(20) faculty?: string;
}

export class CreateAccountDto {
  @IsString() @Matches(/^\S+$/) @MaxLength(100) username!: string;
  @IsString() @Matches(/\S/) @MinLength(8) @MaxLength(128) password!: string;
  @IsString() @Matches(/\S/) @MaxLength(150) name!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsEmail() @MaxLength(150) email!: string;
  @IsOptional() @IsString() @MaxLength(20) faculty?: string;
  @IsIn(['user', 'staff']) role!: 'user' | 'staff';
}
