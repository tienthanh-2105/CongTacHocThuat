import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegistrationRepository } from '../../data/repositories/registration/registration.repository';
import type {
  AssignSupportDto,
  JoinCompetitionTeamDto,
  RegisterIndividualDto,
  RegisterTeamDto,
} from '../../presentation/registration/registration.dto';
import type { SessionContext } from '../auth/auth.types';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(RegistrationRepository)
    private readonly repository: RegistrationRepository,
  ) {}

  private requireStaff(context:SessionContext) {
    const roles=context.user.roles.map(role=>role.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,''));
    if(!roles.some(role=>['ADMIN','CANBOKHOA','GIANGVIEN','BANTOCHUC'].includes(role))) throw new ForbiddenException('Bạn không có quyền quản lý đăng ký');
  }

  async registerIndividual(userId: string | number, dto: RegisterIndividualDto) {
    const student = await this.repository.findStudentByUserId(userId);
    if (!student) {
      throw new BadRequestException('Tài khoản của bạn chưa được liên kết với hồ sơ sinh viên');
    }

    const activity = await this.repository.findActivityById(dto.maHD);
    if (!activity) {
      throw new NotFoundException(`Không tìm thấy hoạt động học thuật với mã: ${dto.maHD}`);
    }

    if (activity.TrangThai === 'Đã hủy' || activity.TrangThai === 'Đã kết thúc') {
      throw new BadRequestException(`Hoạt động này hiện ở trạng thái "${activity.TrangThai}", không tiếp nhận đăng ký`);
    }

    if (activity.HanDangKy && new Date(activity.HanDangKy).getTime() < Date.now()) {
      throw new BadRequestException('Đã hết hạn đăng ký cho hoạt động này');
    }

    const existing = await this.repository.findRegistration(dto.maHD, student.MaSV);
    if (existing && existing.TrangThai !== 'Đã hủy') {
      throw new ConflictException(`Bạn đã đăng ký tham gia hoạt động này rồi (Trạng thái: ${existing.TrangThai})`);
    }

    const result = await this.repository.registerIndividualWithinCapacity(dto.maHD,student.MaSV,dto.hinhThuc ?? 'Dự thi');
    if(!result) throw new NotFoundException(`Không tìm thấy hoạt động học thuật với mã: ${dto.maHD}`);
    if(result.waitlisted) return {
      message: 'Hoạt động đã đủ chỗ; bạn được đưa vào danh sách chờ theo thứ tự đăng ký',
      data: { maCho: result.MaCho, viTri: result.ViTri, maHD: dto.maHD, trangThai: 'Đang chờ' },
    };
    await this.repository.createRegistrationNotification(result.MaDK);

    return {
      message: 'Đăng ký tham gia hoạt động thành công',
      data: {
        maDK: result.MaDK,
        maHD: dto.maHD,
        tenHoatDong: activity.TenHoatDong,
        ngayDK: result.NgayDK,
        sinhVien: {
          maSV: student.MaSV,
          mssv: student.MSSV,
          hoTen: student.HoTen,
          tenLop: student.TenLop,
        },
        hinhThuc: dto.hinhThuc ?? 'Dự thi',
        trangThai: 'Đã đăng ký',
      },
    };
  }

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

    // Deduplicate member MSSVs
    const uniqueMssvs = Array.from(new Set(dto.thanhVienMSSV.map((m) => m.trim())));
    if (uniqueMssvs.length > 4) throw new BadRequestException('Mỗi đội tối đa 5 thành viên tính cả trưởng đội');
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

    const waitlisted = await this.repository.createWaitlistedTeam(
      competition.MaCThi,competition.MaHD,cleanTeamName,captain.MaSV,resolvedMemberIds,
    );
    if (waitlisted) {
      return {
        message: 'Cuộc thi đã đủ chỗ; các thành viên được đưa vào danh sách chờ theo thứ tự đăng ký.',
        data: {
          maCThi: competition.MaCThi,
          maDoi:waitlisted.maDoi,
          tenDoi: cleanTeamName,
          trangThai: 'Đang chờ',
          danhSachCho: waitlisted.queue.map((item) => ({
            maCho: item.MaCho,
            viTri: item.ViTri,
            maSV: item.MaSV,
          })),
        },
      };
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

  async joinCompetitionTeam(userId: string | number, dto: JoinCompetitionTeamDto) {
    const student = await this.repository.findStudentByUserId(userId);
    if (!student) {
      throw new BadRequestException('Tài khoản của bạn chưa được liên kết với hồ sơ sinh viên');
    }

    const team = await this.repository.findTeamById(dto.maDoi);
    if (!team) throw new NotFoundException(`Không tìm thấy đội có mã: ${dto.maDoi}`);
    if (team.TrangThai === 'Đã hủy' || team.TrangThai === 'Đã kết thúc') {
      throw new BadRequestException(`Cuộc thi hiện ở trạng thái "${team.TrangThai}", không tiếp nhận đăng ký`);
    }
    if (team.HanDangKy && new Date(team.HanDangKy).getTime() < Date.now()) {
      throw new BadRequestException('Đã hết hạn đăng ký cho cuộc thi này');
    }

    const existingTeam = await this.repository.findStudentTeamInCompetition(team.MaCThi, student.MaSV);
    if (existingTeam) {
      throw new ConflictException(`Bạn đã tham gia đội thi "${existingTeam.TenDoi}" trong cuộc thi này`);
    }
    const joined = await this.repository.addStudentToTeam(team.MaDoi, team.MaHD, student.MaSV);
    if(joined.waitlisted) return {
      message:'Đội đã đủ chỉ tiêu; bạn đã vào danh sách chờ theo thứ tự đăng ký.',
      data:{maDoi:team.MaDoi,tenDoi:team.TenDoi,maCho:joined.maCho,viTri:joined.viTri,trangThai:'Đang chờ'},
    };
    return {
      message: 'Tham gia đội thi thành công',
      data: {
        maDoi: team.MaDoi,
        tenDoi: team.TenDoi,
        maCThi: team.MaCThi,
        tenCuocThi: team.TenCuocThi,
        thanhVien: { maSV: student.MaSV, mssv: student.MSSV, hoTen: student.HoTen },
      },
    };
  }

  async getMyRegistrations(userId: string | number) {
    const student = await this.repository.findStudentByUserId(userId);
    if (!student) {
      return [];
    }
    return this.repository.getMyRegistrations(student.MaSV);
  }

  async getRegistrationsByActivity(context:SessionContext,activityId: number) {
    this.requireStaff(context);
    const activity = await this.repository.findActivityById(activityId);
    if (!activity) {
      throw new NotFoundException(`Không tìm thấy hoạt động với mã: ${activityId}`);
    }
    return this.repository.getRegistrationsByActivity(activityId);
  }

  async updateRegistrationStatus(context: SessionContext, maDK: number, trangThai: string) {
    this.requireStaff(context);
    const updated = await this.repository.updateRegistrationStatus(maDK, trangThai);
    if (!updated) {
      throw new NotFoundException(`Không tìm thấy đơn đăng ký với mã: ${maDK}`);
    }
    return { message: `Cập nhật trạng thái đơn đăng ký thành "${trangThai}" thành công` };
  }

  async assignSupport(context:SessionContext,dto: AssignSupportDto) {
    this.requireStaff(context);
    const activity = await this.repository.findActivityById(dto.maHD);
    if (!activity) {
      throw new NotFoundException(`Không tìm thấy hoạt động với mã: ${dto.maHD}`);
    }

    await this.repository.assignSupport(
      dto.maHD,
      dto.maLop,
      dto.soLuong,
      dto.loaiPhanCong,
      dto.nhiemVu ?? null,
    );

    return {
      message: `Phân bổ chỉ tiêu ${dto.loaiPhanCong.toLowerCase()} cho lớp thành công`,
      data: dto,
    };
  }

  async getSupportAssignments(context:SessionContext,activityId: number) {
    this.requireStaff(context);
    const activity = await this.repository.findActivityById(activityId);
    if (!activity) {
      throw new NotFoundException(`Không tìm thấy hoạt động với mã: ${activityId}`);
    }
    return this.repository.getSupportAssignments(activityId);
  }
}
