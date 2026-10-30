import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePlanDto {
  @IsOptional() @IsString() @MaxLength(50) soKeHoach?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) tenKeHoach!: string;
  @IsOptional() @IsDateString() ngayBanHanh?: string;
  @IsString() @MaxLength(20) namHoc!: string;
  @IsOptional() @IsString() canCu?: string;
  @IsOptional() @IsString() mucDich?: string;
  @IsOptional() @IsString() yeuCau?: string;
  @IsOptional() @IsString() noiDung?: string;
  @IsOptional() @IsString() @MaxLength(30) hocKy?: string;
  @Type(() => Number) @IsInt() @Min(1) maKhoa!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maBM?: number;
  @IsOptional() @IsIn(['KHOA', 'BO_MON']) loaiKeHoach?: 'KHOA' | 'BO_MON';
}

export class CreatePlanActivityDto {
  @IsString() @IsNotEmpty() @MaxLength(250) tenHoatDong!: string;
  @IsOptional() @IsString() noiDung?: string;
  @IsOptional() @IsDateString() thoiGianDuKien?: string;
  @IsOptional() @IsDateString() thoiGianKetThuc?: string;
  @IsOptional() @IsDateString() hanDangKy?: string;
  @IsOptional() @IsString() @MaxLength(255) diaDiem?: string;
  @IsOptional() @IsString() @MaxLength(500) doiTuong?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) chiTieu?: number;
  @IsOptional() @IsString() @MaxLength(200) nguoiPhuTrach?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) duToan!: number;
}

export class ReviewPlanDto {
  @IsIn(['approve', 'request_changes', 'reject']) action!: 'approve' | 'request_changes' | 'reject';
  @IsOptional() @IsString() @MaxLength(2000) ghiChu?: string;
}

export class CreateRoundDto {
  @Type(() => Number) @IsInt() @Min(1) maCThi!: number;
  @IsString() @IsNotEmpty() @MaxLength(150) tenVong!: string;
  @Type(() => Number) @IsInt() @Min(1) thuTu!: number;
  @IsOptional() @IsString() moTa?: string;
  @IsOptional() @IsDateString() batDauLuc?: string;
  @IsOptional() @IsDateString() ketThucLuc?: string;
  @IsOptional() @IsDateString() hanNopBai?: string;
}

export class SubmitWorkDto {
  @Type(() => Number) @IsInt() @Min(1) maDK!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maDoi?: number;
  @IsString() @IsNotEmpty() @MaxLength(250) tieuDe!: string;
  @IsOptional() @IsString() moTa?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tepDinhKem?: string[];
}

export class ScoreWorkDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) diem!: number;
  @IsOptional() @IsString() nhanXet?: string;
}

export class CompetitionResultDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maDK?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maDoi?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maGT?: number;
  @IsOptional() @IsString() @MaxLength(50) loaiKQ?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) xepHang?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) diem?: number;
  @IsOptional() @IsString() ghiChu?: string;
}

export class AwardTrainingPointDto {
  @Type(() => Number) @IsInt() @Min(1) maSV!: number;
  @Type(() => Number) @IsInt() @Min(1) maHD!: number;
  @IsOptional() @IsString() @MaxLength(30) hocKy?: string;
  @IsString() @IsNotEmpty() @MaxLength(20) namHoc!: string;
  @Type(() => Number) @IsInt() @Min(-999) @Max(999) diem!: number;
  @IsString() @IsNotEmpty() @MaxLength(1000) lyDo!: string;
}

export class AdjustTrainingPointDto {
  @Type(() => Number) @IsInt() @Min(-999) @Max(999) diemMoi!: number;
  @IsString() @IsNotEmpty() @MaxLength(1000) lyDo!: string;
}

export class CreateAttendanceCodeDto {
  @IsDateString() expiresAt!: string;
}

export class CheckInDto {
  @IsString() @IsNotEmpty() @MaxLength(100) code!: string;
}

export class SeminarMaterialDto {
  @IsString() @IsNotEmpty() @MaxLength(250) tenTep!: string;
  @IsString() @IsNotEmpty() @MaxLength(2048) urlTep!: string;
  @IsOptional() @IsString() @MaxLength(80) loaiTep?: string;
}

export class ActivityChangeDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsString() @MaxLength(255) venue?: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) reason!: string;
}

export class CreateAccountDto {
  @IsString() @IsNotEmpty() @MaxLength(100) username!: string;
  @IsString() @IsNotEmpty() @MinLength(12) @MaxLength(72) password!: string;
  @Type(() => Number) @IsInt() @Min(1) roleId!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maNgDung?: number;
}

export class CreateStudentProfileDto {
  @IsString() @IsNotEmpty() @MaxLength(150) hoTen!: string;
  @IsString() @IsNotEmpty() @MaxLength(20) mssv!: string;
  @Type(() => Number) @IsInt() @Min(1) maLop!: number;
  @IsOptional() @IsEmail() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(15) sdt?: string;
  @IsOptional() @IsDateString() ngaySinh?: string;
  @IsOptional() @IsIn(['Nam', 'Nữ', 'Khác']) gioiTinh?: string;
}

export class CreateStudentAccountDto {
  @IsString() @IsNotEmpty() @MinLength(12) @MaxLength(72) password!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) hoTen!: string;
  @Type(() => Number) @IsInt() @Min(1) maLop!: number;
  @IsOptional() @IsEmail() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(15) sdt?: string;
  @IsOptional() @IsDateString() ngaySinh?: string;
  @IsOptional() @IsIn(['Nam', 'Nữ', 'Khác']) gioiTinh?: string;
}

export class CreateLinkedStudentProfileDto {
  @Type(() => Number) @IsInt() @Min(1) maTK!: number;
  @IsString() @IsNotEmpty() @MaxLength(150) hoTen!: string;
  @Type(() => Number) @IsInt() @Min(1) maLop!: number;
  @IsOptional() @IsEmail() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(15) sdt?: string;
  @IsOptional() @IsDateString() ngaySinh?: string;
  @IsOptional() @IsIn(['Nam', 'Nữ', 'Khác']) gioiTinh?: string;
}

export class ChangeAccountRoleDto {
  @Type(() => Number) @IsInt() @Min(1) roleId!: number;
}

export class ResetAccountPasswordDto {
  @IsString() @IsNotEmpty() @MinLength(12) @MaxLength(72) password!: string;
}

export class SetAccountStatusDto {
  @IsBoolean() active!: boolean;
}

export class LinkAccountStudentProfileDto {
  @Type(() => Number) @IsInt() @Min(1) maNgDung!: number;
}

export class ManualAttendanceDto {
  @Type(() => Number) @IsInt() @Min(1) maDK!: number;
}

export class UpdateStudentRecordDto {
  @IsOptional() @IsString() @MaxLength(150) hoTen?: string;
  @IsOptional() @IsString() @MaxLength(20) mssv?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maLop?: number;
  @IsOptional() @IsEmail() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(15) sdt?: string;
  @IsOptional() @IsDateString() ngaySinh?: string;
  @IsOptional() @IsIn(['Nam', 'Nữ', 'Khác']) gioiTinh?: string;
}


export class CreateClassDto {
  @IsString() @IsNotEmpty() @MaxLength(100) tenLop!: string;
  @Type(() => Number) @IsInt() @Min(1) maKhoa!: number;
  @IsOptional() @IsString() @MaxLength(50) khoaHoc?: string;
}

export class UpdateClassDto {
  @IsOptional() @IsString() @MaxLength(100) tenLop?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maKhoa?: number;
  @IsOptional() @IsString() @MaxLength(50) khoaHoc?: string;
}


export class UpdateStaffRecordDto {
  @IsOptional() @IsString() @MaxLength(150) hoTen?: string;
  @IsOptional() @IsString() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(20) sdt?: string;
  @IsOptional() @IsString() @MaxLength(100) hocVi?: string;
  @IsOptional() @IsString() @MaxLength(150) chucVu?: string;
  @IsOptional() @Type(() => Number) @IsInt() maBM?: number | null;
  @IsOptional() @IsArray() maBMList?: number[];
  @IsOptional() @Type(() => Number) @IsInt() maKhoa?: number | null;
  @IsOptional() @IsString() @MaxLength(50) trangThai?: string;
}

export class CreateStaffRecordDto {
  @IsString() @IsNotEmpty() @MaxLength(100) hoTen!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) hocVi!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) chucVu!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maBM?: number;
  @IsOptional() @IsArray() maBMList?: number[];
  @IsOptional() @IsString() @MaxLength(150) email?: string;
  @IsOptional() @IsString() @MaxLength(20) sdt?: string;
  @IsOptional() @IsBoolean() createAccount?: boolean;
  @IsOptional() @IsString() @MaxLength(100) username?: string;
  @IsOptional() @MinLength(6) @MaxLength(72) password?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) roleId?: number;
}

export class CreateStaffAccountDto {
  @IsString() @IsNotEmpty() @MaxLength(100) username!: string;
  @IsString() @IsNotEmpty() @MinLength(6) @MaxLength(72) password!: string;
  @Type(() => Number) @IsInt() @Min(1) roleId!: number;
}

export class CreateAcademicActivityDto {
  @IsOptional() @IsString() @MaxLength(30) hocKy?: string;
  @IsString() @IsNotEmpty() @MaxLength(20) namHoc!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maBM?: number;
  @IsString() @IsNotEmpty() @MaxLength(250) tenHoatDong!: string;
  @IsIn(['Cuộc thi', 'Seminar', 'Workshop', 'Tọa đàm']) loaiHoatDong!: 'Cuộc thi' | 'Seminar' | 'Workshop' | 'Tọa đàm';
  @IsString() @IsNotEmpty() noiDung!: string;
  @IsOptional() @IsString() tgDuKien?: string;
  @IsOptional() @IsString() tgBatDau?: string;
  @IsOptional() @IsString() tgKetThuc?: string;
  @IsOptional() @IsString() @MaxLength(255) diaDiem?: string;
  @IsOptional() @IsString() tienDoTH?: string;
  @IsString() @IsNotEmpty() doiTuongThamDu!: string;
  @Type(() => Number) @IsInt() @Min(0) slsvDuKien!: number;
}

export class CreateActivityBudgetDto {
  @IsString() @IsNotEmpty() noiDung!: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) soLuong?: number;
  @IsOptional() @IsString() @MaxLength(50) donViTinh?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) donGia?: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) soTien!: number;
  @IsOptional() @IsString() @MaxLength(500) thuyetMinh?: string;
  @IsOptional() @IsString() @MaxLength(100) nguonKinhPhi?: string;
  @IsOptional() @IsString() @MaxLength(500) ghiChu?: string;
}

export class ReviewActivityBudgetDto {
  @IsIn(['approve', 'reject']) action!: 'approve' | 'reject';
  @IsOptional() @IsString() @MaxLength(500) ghiChu?: string;
}

export class UpdateAcademicActivityDto {
  @IsOptional() @IsString() @MaxLength(30) hocKy?: string;
  @IsOptional() @IsString() @MaxLength(20) namHoc?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maBM?: number;
  @IsOptional() @IsString() @MaxLength(250) tenHoatDong?: string;
  @IsOptional() @IsIn(['Cuộc thi', 'Seminar', 'Workshop', 'Tọa đàm']) loaiHoatDong?: 'Cuộc thi' | 'Seminar' | 'Workshop' | 'Tọa đàm';
  @IsOptional() @IsString() noiDung?: string;
  @IsOptional() @IsString() tgDuKien?: string;
  @IsOptional() @IsString() tgBatDau?: string;
  @IsOptional() @IsString() tgKetThuc?: string;
  @IsOptional() @IsString() @MaxLength(255) diaDiem?: string;
  @IsOptional() @IsString() tienDoTH?: string;
  @IsOptional() @IsString() doiTuongThamDu?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) slsvDuKien?: number;
  @IsOptional() @IsIn(['Dự thảo', 'Chờ duyệt', 'Đã duyệt', 'Từ chối']) trangThai?: string;
}

export class CreateCommitteeMemberDto {
  @Type(() => Number) @IsInt() @Min(1) maHD!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maNgDung?: number;
  @IsString() @IsNotEmpty() @MaxLength(100) hoTen!: string;
  @IsOptional() @IsString() @MaxLength(100) hocVi?: string;
  @IsOptional() @IsString() @MaxLength(150) chucDanh?: string;
  @IsOptional() @IsString() @MaxLength(100) chucVu?: string;
  @IsOptional() @IsString() nhiemVu?: string;
}

export class UpdateCommitteeMemberDto {
  @Type(() => Number) @IsInt() @Min(1) maHD!: number;
  @IsString() @IsNotEmpty() @MaxLength(100) hoTen!: string;
  @IsOptional() @IsString() @MaxLength(100) hocVi?: string;
  @IsOptional() @IsString() @MaxLength(150) chucDanh?: string;
  @IsOptional() @IsString() @MaxLength(100) chucVu?: string;
  @IsOptional() @IsString() nhiemVu?: string;
}

