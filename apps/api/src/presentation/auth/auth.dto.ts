import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'bcryptPasswordLength', async: false })
class BcryptPasswordLength implements ValidatorConstraintInterface {
  validate(value: unknown) { return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72; }
  defaultMessage() { return 'Mật khẩu không được vượt quá 72 byte UTF-8'; }
}

export class LoginDto {
  @ApiProperty({ example: 'admin.demo' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  @ApiProperty({ minLength: 1, maxLength: 72, format: 'password' })
  @IsString()
  @MinLength(1)
  @Validate(BcryptPasswordLength)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MinLength(1)
  @Validate(BcryptPasswordLength)
  currentPassword!: string;

  @ApiProperty({ minLength: 12, maxLength: 72, format: 'password' })
  @IsString()
  @MinLength(12)
  @Validate(BcryptPasswordLength)
  newPassword!: string;
}
