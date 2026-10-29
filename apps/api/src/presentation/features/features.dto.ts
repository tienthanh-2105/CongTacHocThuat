import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class SeminarSpeakerDto {
  @IsString() @IsNotEmpty() @MaxLength(150) hoTen!: string;
  @IsOptional() @IsString() @MaxLength(200) hocVi?: string;
  @IsOptional() @IsString() @MaxLength(300) donVi?: string;
  @IsOptional() @IsString() @MaxLength(1000) tieuSu?: string;
  @IsOptional() @IsString() @MaxLength(250) chuDeTrinhBay?: string;
}

export class SeminarAgendaItemDto {
  @IsString() @IsNotEmpty() @MaxLength(150) thoiGian!: string;
  @IsString() @IsNotEmpty() @MaxLength(250) noiDung!: string;
  @IsOptional() @IsString() @MaxLength(150) phuTrach?: string;
}

export class CreateSeminarDto {
  @IsString() @IsNotEmpty() @MaxLength(250)
  tenHoatDong!: string;

  @IsOptional() @IsString() @MaxLength(4000)
  moTa?: string;

  @IsDateString()
  tgBatDau!: string;

  @IsDateString()
  tgKetThuc!: string;

  @IsOptional() @IsDateString()
  hanDangKy?: string;

  @IsOptional() @IsString() @MaxLength(255)
  diaDiem?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  slToiDa?: number;

  @IsString() @IsNotEmpty() @MaxLength(250)
  chuDe!: string;

  @IsOptional() @IsString() @MaxLength(4000)
  noiDung?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  doiTuongTG?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440)
  thoiLuong?: number;

  @IsOptional() @IsString() @MaxLength(200)
  dvChuTri?: string;

  @IsOptional() @IsString() @MaxLength(200)
  dvPhoiHop?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => SeminarSpeakerDto)
  dienGia?: SeminarSpeakerDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SeminarAgendaItemDto)
  chuongTrinh?: SeminarAgendaItemDto[];
}

export class CreateExpenseDto {
  @Type(() => Number) @IsInt() @Min(1)
  maHD!: number;

  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(2000)
  noiDung!: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999999999)
  soTien!: number;

  @IsDateString()
  ngChi!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(2048, { each: true })
  chungTu?: string[];
}
