import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterIndividualDto {
  @ApiProperty({ description: 'Mã hoạt động học thuật', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maHD!: number;

  @ApiPropertyOptional({
    description: 'Hình thức đăng ký',
    enum: ['Dự thi', 'Tham gia', 'Hỗ trợ', 'Cổ vũ'],
    default: 'Dự thi',
  })
  @IsOptional()
  @IsIn(['Dự thi', 'Tham gia', 'Hỗ trợ', 'Cổ vũ'])
  hinhThuc?: 'Dự thi' | 'Tham gia' | 'Hỗ trợ' | 'Cổ vũ';
}

export class RegisterTeamDto {
  @ApiProperty({ description: 'Mã cuộc thi học thuật', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maCThi!: number;

  @ApiProperty({ description: 'Tên đội thi (duy nhất trong cuộc thi)', example: 'Code Warriors' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  tenDoi!: string;

  @ApiProperty({
    description: 'Danh sách MSSV của các thành viên trong đội (không bao gồm trưởng đội)',
    example: ['2001230002', '2001230003'],
  })
  @IsArray()
  @ArrayMaxSize(4, { message: 'Mỗi đội tối đa 5 thành viên tính cả trưởng đội' })
  @ArrayNotEmpty()
  @IsString({ each: true })
  thanhVienMSSV!: string[];
}

export class JoinCompetitionTeamDto {
  @ApiProperty({ description: 'Mã đội được trưởng đội cung cấp', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maDoi!: number;
}

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới của đơn đăng ký',
    enum: ['Đã đăng ký', 'Đã xác nhận', 'Đã hủy', 'Từ chối'],
  })
  @IsIn(['Đã đăng ký', 'Đã xác nhận', 'Đã hủy', 'Từ chối'])
  trangThai!: 'Đã đăng ký' | 'Đã xác nhận' | 'Đã hủy' | 'Từ chối';
}

export class AssignSupportDto {
  @ApiProperty({ description: 'Mã hoạt động học thuật', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maHD!: number;

  @ApiProperty({ description: 'Mã lớp được phân bổ', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maLop!: number;

  @ApiProperty({ description: 'Số lượng sinh viên chỉ tiêu', example: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  soLuong!: number;

  @ApiProperty({ description: 'Loại phân công', enum: ['Cổ vũ', 'Hỗ trợ'], default: 'Cổ vũ' })
  @IsIn(['Cổ vũ', 'Hỗ trợ'])
  loaiPhanCong!: 'Cổ vũ' | 'Hỗ trợ';

  @ApiPropertyOptional({ description: 'Nội dung nhiệm vụ chi tiết', example: 'Có mặt trước 30 phút tại hội trường A' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nhiemVu?: string;
}
