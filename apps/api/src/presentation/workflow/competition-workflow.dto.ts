import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CompetitionRoundDto {
  @IsString() @IsNotEmpty() @MaxLength(150) tenVong!: string;
  @Type(() => Number) @IsInt() @Min(1) thuTu!: number;
  @IsOptional() @IsString() @MaxLength(8000) moTa?: string;
  @IsDateString() batDauLuc!: string;
  @IsDateString() ketThucLuc!: string;
  @IsDateString() hanNopBai!: string;
}
export class RoundAssignmentDto {
  @Type(() => Number) @IsInt() @Min(1) maTK!: number;
  @IsIn(['RA_DE','CHAM_THI']) vaiTro!: 'RA_DE'|'CHAM_THI';
}
export class RoundStatusDto {
  @IsIn(['Chưa mở','Đang mở','Đã đóng']) trangThai!: 'Chưa mở'|'Đang mở'|'Đã đóng';
}
export class RoundRegistrationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maDoi?: number;
}
export class RoundExamDto {
  @IsString() @IsNotEmpty() @MaxLength(30000) noiDung!: string;
  @IsOptional() @IsString() @MaxLength(2048) @Matches(/^https?:\/\//i) urlTep?: string;
}
export class RoundSubmissionDto {
  @IsString() @IsNotEmpty() @MaxLength(250) tieuDe!: string;
  @IsOptional() @IsString() @MaxLength(30000) moTa?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({each:true}) @MaxLength(2048,{each:true}) @Matches(/^https?:\/\//i,{each:true}) tepDinhKem?: string[];
}
export class RoundScoreDto {
  @Type(() => Number) @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(100) diem!: number;
  @IsOptional() @IsString() @MaxLength(5000) nhanXet?: string;
}
export class CompetitionAwardDto {
  @IsString() @IsNotEmpty() @MaxLength(150) tenGT!: string;
  @IsOptional() @Type(() => Number) @IsNumber({maxDecimalPlaces:2}) @Min(0) tienThuong?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) slGiai?: number;
}
export class GradedCompetitionResultDto {
  @Type(() => Number) @IsInt() @Min(1) maBai!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maGT?: number;
  @IsOptional() @IsString() @MaxLength(150) tenGiai?: string;
  @Type(() => Number) @IsInt() @Min(1) xepHang!: number;
  @IsOptional() @IsString() @MaxLength(5000) ghiChu?: string;
}
