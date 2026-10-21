import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
