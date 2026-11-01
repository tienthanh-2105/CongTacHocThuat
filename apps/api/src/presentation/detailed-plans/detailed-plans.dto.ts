import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveDetailedPlanDto {
  @IsString() @IsNotEmpty() @MaxLength(250) tenKeHoach!: string;
  @IsString() @IsNotEmpty() noiDung!: string;
  @IsOptional() @IsString() theLe?: string;
  @IsOptional() @IsString() tieuChiCham?: string;
  @IsOptional() @IsIn(['Cá nhân', 'Theo đội']) hinhThucThi?: 'Cá nhân' | 'Theo đội';
  @IsDateString() thoiGianBatDau!: string;
  @IsDateString() thoiGianKetThuc!: string;
  @IsOptional() @IsDateString() hanDangKy?: string;
  @IsOptional() @IsString() @MaxLength(255) diaDiem?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) diemRenLuyen?: number;
}

export class ReviewDetailedPlanDto {
  @IsIn(['approve', 'request_changes', 'reject']) action!: 'approve' | 'request_changes' | 'reject';
  @IsOptional() @IsString() @MaxLength(2000) ghiChu?: string;
}
