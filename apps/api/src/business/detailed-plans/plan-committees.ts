import { BadRequestException } from '@nestjs/common';
import { committeeTypes, type PlanCommitteeDto } from '../../presentation/detailed-plans/detailed-plans.dto';

export function readPlanCommittees(value: string | null | undefined): PlanCommitteeDto[] {
  return value ? JSON.parse(value) as PlanCommitteeDto[] : [];
}

export function inferLoaiBan(loaiBan?: string | null, tenBan?: string | null): typeof committeeTypes[number] {
  if (loaiBan && committeeTypes.includes(loaiBan as any) && loaiBan !== 'KHAC') {
    return loaiBan as any;
  }
  const norm = (tenBan || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (norm.includes('chi dao')) return 'CHI_DAO';
  if (norm.includes('to chuc')) return 'TO_CHUC';
  if (norm.includes('de thi') || norm.includes('ra de')) return 'DE_THI';
  if (norm.includes('thu ky')) return 'THU_KY';
  if (norm.includes('giam khao') || norm.includes('cham thi') || norm.includes('cham diem')) return 'CHAM_THI';
  if (norm.includes('hau can')) return 'HAU_CAN';
  if (norm.includes('truyen thong')) return 'TRUYEN_THONG';
  return 'KHAC';
}

export function validatePlanCommittees(committees: PlanCommitteeDto[], staffIds: number[], submitting = false, competition = false) {
  if (!Array.isArray(committees) || committees.length > 20) throw new BadRequestException('Tối đa 20 ban trong kế hoạch');
  const names = new Set<string>();
  const kinds = new Set<string>();
  for (const committee of committees) {
    const name = committee.tenBan?.trim();
    const loaiBan = inferLoaiBan(committee.loaiBan, name);
    if (!name || name.length > 150) throw new BadRequestException('Tên ban không hợp lệ');
    const key = name.toLocaleLowerCase('vi-VN');
    if (names.has(key) || (loaiBan !== 'KHAC' && kinds.has(loaiBan))) throw new BadRequestException('Tên ban hoặc loại ban bị trùng');
    names.add(key); kinds.add(loaiBan);
    if (!Array.isArray(committee.thanhVien) || committee.thanhVien.length > 100) throw new BadRequestException('Tối đa 100 giảng viên mỗi ban');
    const members = new Set<number>();
    let heads = 0;
    for (const member of committee.thanhVien) {
      if (!Number.isSafeInteger(member.maTK) || !staffIds.includes(member.maTK)) throw new BadRequestException('Chọn giảng viên đang hoạt động thuộc khoa phụ trách');
      if (members.has(member.maTK)) throw new BadRequestException('Một giảng viên chỉ xuất hiện một lần trong mỗi ban');
      members.add(member.maTK);
      const role = member.vaiTro?.trim() || 'Thành viên';
      if (!role) throw new BadRequestException('Cần nhập chức vụ trong ban cho từng giảng viên');
      if (role === 'Trưởng ban') heads++;
      if (member.hanHoanThanh && !Number.isFinite(new Date(member.hanHoanThanh).getTime())) throw new BadRequestException('Hạn hoàn thành không hợp lệ');
    }
    if (heads > 1) throw new BadRequestException('Mỗi ban chỉ có một Trưởng ban');
    if (submitting && !members.size) throw new BadRequestException(`Cần phân công giảng viên cho ${name} trước khi trình ký`);
  }
  if (submitting && (!kinds.has('TO_CHUC') || (competition && !kinds.has('DE_THI')))) {
    throw new BadRequestException(competition ? 'Cần lập Ban tổ chức và Ban đề thi trước khi trình ký cuộc thi' : 'Cần lập Ban tổ chức trước khi trình ký');
  }
  return committees.map(committee => ({
    ...committee,
    loaiBan: inferLoaiBan(committee.loaiBan, committee.tenBan),
    tenBan: committee.tenBan.trim(),
    nhiemVu: committee.nhiemVu?.trim(),
    thanhVien: committee.thanhVien.map(member => ({
      ...member,
      vaiTro: member.vaiTro?.trim() || 'Thành viên',
      chucDanh: member.chucDanh?.trim(),
      nhiemVu: member.nhiemVu?.trim() || member.vaiTro?.trim() || 'Nhiệm vụ trong ban',
      sanPham: member.sanPham?.trim(),
    })),
  }));
}
