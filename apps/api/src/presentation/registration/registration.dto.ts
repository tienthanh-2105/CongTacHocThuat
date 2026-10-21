import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

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
