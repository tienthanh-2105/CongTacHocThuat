import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới của đơn đăng ký',
    enum: ['Đã đăng ký', 'Đã xác nhận', 'Đã hủy', 'Từ chối'],
  })
  @IsIn(['Đã đăng ký', 'Đã xác nhận', 'Đã hủy', 'Từ chối'])
  trangThai!: 'Đã đăng ký' | 'Đã xác nhận' | 'Đã hủy' | 'Từ chối';
}
