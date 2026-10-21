import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'bcryptPasswordBytes', async: false })
class BcryptPasswordBytes implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72;
  }
  defaultMessage() {
    return 'Mật khẩu không được vượt quá 72 byte UTF-8';
  }
}

export class CreateManagedUserDto {
  @ApiProperty({ example: 'gv.nguyenvana' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9_.-]+$/)
  tenDangNhap!: string;

  @ApiProperty({ minLength: 12, format: 'password' })
  @IsString()
  @MinLength(12)
  @Validate(BcryptPasswordBytes)
  matKhau!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  hoTen!: string;

  @ApiProperty({ example: 3, description: 'Mã vai trò trong danh mục VAITRO' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maVaiTro!: number;

  @ApiPropertyOptional({ example: 'vana@example.edu.vn' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @Matches(/^0\d{9,10}$/)
  sdt?: string | null;

  @ApiPropertyOptional({ example: '2002-05-10' })
  @IsOptional()
  @IsDateString()
  ngaySinh?: string | null;

  @ApiPropertyOptional({ enum: ['Nam', 'Nữ', 'Khác'] })
  @IsOptional()
  @IsIn(['Nam', 'Nữ', 'Khác'])
  gioiTinh?: 'Nam' | 'Nữ' | 'Khác' | null;
}

export class UpdateManagedUserDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  hoTen?: string;

  @ApiPropertyOptional({ example: 'vana@example.edu.vn' })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string | null;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @Matches(/^0\d{9,10}$/)
  sdt?: string | null;

  @ApiPropertyOptional({ description: 'Đổi vai trò được gán cho tài khoản' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maVaiTro?: number;

  @ApiPropertyOptional({ description: 'Khóa hoặc mở khóa tài khoản' })
  @IsOptional()
  @IsBoolean()
  hoatDong?: boolean;

  @ApiPropertyOptional({ minLength: 12, format: 'password', description: 'Đặt lại mật khẩu; phiên cũ sẽ bị thu hồi' })
  @IsOptional()
  @IsString()
  @MinLength(12)
  @Validate(BcryptPasswordBytes)
  matKhauMoi?: string;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [Number], example: [1, 3, 4, 10] })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  quyenIds!: number[];
}

export class CreatePlanDto {
  @ApiProperty({ example: 'Kế hoạch tổ chức cuộc thi lập trình' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  tenKeHoach!: string;

  @ApiProperty({ example: '2026-2027' })
  @IsString()
  @Matches(/^\d{4}-\d{4}$/)
  namHoc!: string;

  @ApiPropertyOptional({ example: 'Học kỳ 1' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  hocKy?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maKhoa!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ngPhuTrach?: number;

  @ApiPropertyOptional({ example: 1 })
  @ValidateIf((value: CreatePlanDto) => value.maBM !== undefined || value.loaiKeHoach === 'BO_MON')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maBM?: number;

  @ApiProperty({ enum: ['KHOA', 'BO_MON'], example: 'KHOA' })
  @IsIn(['KHOA', 'BO_MON'])
  loaiKeHoach!: 'KHOA' | 'BO_MON';
}

export class ReviewPlanDto {
  @ApiProperty({ enum: ['Đã duyệt', 'Không duyệt', 'Cần bổ sung'] })
  @IsIn(['Đã duyệt', 'Không duyệt', 'Cần bổ sung'])
  trangThai!: 'Đã duyệt' | 'Không duyệt' | 'Cần bổ sung';

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  noiDung?: string;
}

export class CreateCommitteeMemberDto {
  @ApiProperty({ example: 2, description: 'Mã giảng viên' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maGV!: number;

  @ApiPropertyOptional({ example: 'Trưởng ban' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  chucVu?: string;

  @ApiProperty({ example: 'Điều phối và tổng hợp kết quả' })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  nhiemVu!: string;
}

export class CreateCompetitionCommitteeDto {
  @ApiProperty({ example: 'Ban tổ chức cuộc thi' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  tenBan!: string;

  @ApiProperty({ type: [CreateCommitteeMemberDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCommitteeMemberDto)
  thanhVien!: CreateCommitteeMemberDto[];
}
