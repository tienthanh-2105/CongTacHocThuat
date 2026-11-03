import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export const committeeTypes = ['CHI_DAO', 'TO_CHUC', 'DE_THI', 'THU_KY', 'CHAM_THI', 'HAU_CAN', 'TRUYEN_THONG', 'KHAC'] as const;
export class PlanAssignmentDto {
  @Type(() => Number) @IsInt() @Min(1) maTK!: number;
  @IsOptional() @IsString() @MaxLength(1000) hoTen?: string;
  @IsOptional() @IsString() @MaxLength(150) chucDanh?: string;
  @IsOptional() @IsString() @MaxLength(150) vaiTro?: string;
  @IsOptional() @IsString() @MaxLength(4000) nhiemVu?: string;
  @IsOptional() @IsDateString() hanHoanThanh?: string;
  @IsOptional() @IsString() @MaxLength(2000) sanPham?: string;
}
export class PlanCommitteeDto {
  @IsOptional() @IsIn(committeeTypes) loaiBan?: typeof committeeTypes[number];
  @IsString() @IsNotEmpty() @MaxLength(150) tenBan!: string;
  @IsOptional() @IsString() @MaxLength(4000) nhiemVu?: string;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => PlanAssignmentDto) thanhVien!: PlanAssignmentDto[];
}

export class PlanWorkItemDto {
  @IsOptional() @Type(() => Number) @IsInt() stt?: number;
  @IsString() @IsNotEmpty() @MaxLength(4000) noiDung!: string;
  @IsOptional() @IsString() thoiGian?: string;
  @IsOptional() @Type(() => Number) @IsInt() maTK?: number;
  @IsOptional() @IsString() @MaxLength(1000) hoTen?: string;
}

export class SeminarAgendaItemDto {
  @IsString() @IsNotEmpty() @MaxLength(500) noiDung!: string;
  @IsOptional() @IsString() @MaxLength(150) thoiGian?: string;
  @IsOptional() @IsString() @MaxLength(200) dvChuTri?: string;
}

export class SeminarChuDeDto {
  @IsOptional() @Type(() => Number) @IsInt() maChuDe?: number;
  @IsOptional() @Type(() => Number) @IsInt() stt?: number;
  @IsString() @IsNotEmpty() @MaxLength(250) tenChuDe!: string;
  @IsOptional() @IsString() @MaxLength(20) tgBatDau?: string;
  @IsOptional() @IsString() @MaxLength(20) tgKetThuc?: string;
  @IsOptional() @IsString() @MaxLength(150) dienGia?: string;
  @IsOptional() @IsString() noiDungKhac?: string;
}

export class SaveDetailedPlanDto {
  @IsOptional() @IsString() @MaxLength(250) tenKeHoach?: string;
  @IsOptional() @IsString() noiDung?: string;
  @IsOptional() @IsString() theLe?: string;
  @IsOptional() @IsString() tieuChiCham?: string;
  @IsOptional() @IsIn(['Cá nhân', 'Theo đội']) hinhThucThi?: 'Cá nhân' | 'Theo đội';
  @IsOptional() @IsDateString() thoiGianBatDau?: string;
  @IsOptional() @IsDateString() thoiGianKetThuc?: string;
  @IsOptional() @IsDateString() hanDangKy?: string;
  @IsOptional() @IsString() @MaxLength(255) diaDiem?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) diemRenLuyen?: number;
  @IsOptional() @IsString() @MaxLength(50) trangThai?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PlanCommitteeDto) cacBan?: PlanCommitteeDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PlanWorkItemDto) noiDungThucHien?: PlanWorkItemDto[];

  // Competition-specific fields
  @IsOptional() @Type(() => Number) @IsInt() maCThi?: number;
  @IsOptional() @IsString() @MaxLength(250) tenCuocThi?: string;
  @IsOptional() @IsString() @MaxLength(100) capToChuc?: string;
  @IsOptional() @IsString() @MaxLength(250) vongThi?: string;
  @IsOptional() @IsString() dsBanGiamKhao?: string;
  @IsOptional() @IsString() giaiThuong?: string;

  // Seminar-specific fields
  @IsOptional() @IsString() @MaxLength(50) soKeHoach?: string;
  @IsOptional() @IsString() @MaxLength(250) chuDe?: string;
  @IsOptional() @IsString() canCu?: string;
  @IsOptional() @IsString() mucDich?: string;
  @IsOptional() @IsString() yeuCau?: string;
  @IsOptional() @IsString() @MaxLength(225) thoiGian?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) slsvDuKien?: number;
  @IsOptional() @IsString() doiTuongTG?: string;
  @IsOptional() @IsString() noiDungKhac?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SeminarAgendaItemDto) chuongTrinh?: SeminarAgendaItemDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SeminarChuDeDto) chuDeList?: SeminarChuDeDto[];
}

export class ReviewDetailedPlanDto {
  @IsIn(['approve', 'request_changes', 'reject']) action!: 'approve' | 'request_changes' | 'reject';
  @IsOptional() @IsString() @MaxLength(2000) ghiChu?: string;
}
