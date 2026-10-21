import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegistrationRepository } from '../../data/repositories/registration/registration.repository';
import type { RegisterTeamDto } from '../../presentation/registration/registration.dto';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(RegistrationRepository)
    private readonly repository: RegistrationRepository,
  ) {}

  async registerTeam(userId: string | number, dto: RegisterTeamDto) {
    const captain = await this.repository.findStudentByUserId(userId);
    if (!captain) {
      throw new BadRequestException('Tài khoản của bạn chưa được liên kết với hồ sơ sinh viên');
    }

    const competition = await this.repository.findCompetitionById(dto.maCThi);
    if (!competition) {
      throw new NotFoundException(`Không tìm thấy cuộc thi với mã: ${dto.maCThi}`);
    }

    if (competition.TrangThai === 'Đã hủy' || competition.TrangThai === 'Đã kết thúc') {
      throw new BadRequestException(`Cuộc thi hiện ở trạng thái "${competition.TrangThai}", không tiếp nhận đăng ký`);
    }

    if (competition.HanDangKy && new Date(competition.HanDangKy).getTime() < Date.now()) {
      throw new BadRequestException('Đã hết hạn đăng ký cho cuộc thi này');
    }

    const cleanTeamName = dto.tenDoi.trim();
    const existingTeam = await this.repository.findTeamByName(dto.maCThi, cleanTeamName);
    if (existingTeam) {
      throw new ConflictException(`Tên đội "${cleanTeamName}" đã tồn tại trong cuộc thi này. Vui lòng chọn tên khác.`);
    }

    const captainTeam = await this.repository.findStudentTeamInCompetition(dto.maCThi, captain.MaSV);
    if (captainTeam) {
      throw new ConflictException(`Bạn đã tham gia đội thi "${captainTeam.TenDoi}" trong cuộc thi này`);
    }

    const uniqueMssvs = Array.from(new Set(dto.thanhVienMSSV.map((m) => m.trim())));
    const resolvedMemberIds: number[] = [];
    const memberDetails: Array<{ maSV: number; mssv: string; hoTen: string; tenLop: string }> = [];

    for (const mssv of uniqueMssvs) {
      if (mssv === captain.MSSV) {
        throw new BadRequestException('Không thể thêm chính bạn (Trưởng đội) vào danh sách thành viên');
      }

      const member = await this.repository.findStudentByMssv(mssv);
      if (!member) {
        throw new NotFoundException(`Không tìm thấy sinh viên có MSSV: ${mssv}`);
      }

      const memberTeam = await this.repository.findStudentTeamInCompetition(dto.maCThi, member.MaSV);
      if (memberTeam) {
        throw new ConflictException(
          `Sinh viên ${member.HoTen} (${mssv}) đã tham gia đội thi "${memberTeam.TenDoi}" trong cuộc thi này`,
        );
      }

      resolvedMemberIds.push(member.MaSV);
      memberDetails.push({
        maSV: member.MaSV,
        mssv: member.MSSV,
        hoTen: member.HoTen,
        tenLop: member.TenLop,
      });
    }

    const created = await this.repository.createTeamWithMembers(
      dto.maCThi,
      competition.MaHD,
      cleanTeamName,
      captain.MaSV,
      resolvedMemberIds,
    );

    return {
      message: 'Đăng ký đội thi thành công',
      data: {
        maDoi: created.maDoi,
        tenDoi: created.tenDoi,
        cuocThi: {
          maCThi: competition.MaCThi,
          tenCuocThi: competition.TenCuocThi,
        },
        truongDoi: {
          maSV: captain.MaSV,
          mssv: captain.MSSV,
          hoTen: captain.HoTen,
          tenLop: captain.TenLop,
        },
        thanhVien: memberDetails,
        tongThanhVien: created.totalMembers,
      },
    };
  }
}
