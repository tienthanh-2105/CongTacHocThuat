import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsString, MaxLength, Min, MinLength } from 'class-validator';

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
  @ArrayNotEmpty()
  @IsString({ each: true })
  thanhVienMSSV!: string[];
}
