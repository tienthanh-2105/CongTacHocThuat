import { BadRequestException } from '@nestjs/common';
import { committeeTypes, type PlanCommitteeDto, type PlanAssignmentDto } from '../../presentation/detailed-plans/detailed-plans.dto';

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

export function mergeLegacyJudgeCommittee(
  committees: PlanCommitteeDto[],
  judgeList: string | null | undefined,
  staff: Array<{ MaTK: number; HoTen: string }>,
): PlanCommitteeDto[] {
  if (!judgeList?.trim()) return committees;
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').replace(/[^a-z0-9]/g, '');
  const existing = committees.find(item => inferLoaiBan(item.loaiBan, item.tenBan) === 'CHAM_THI');
  const members: PlanAssignmentDto[] = [];
  const seen = new Set<number>();
  for (const line of judgeList.split(/[\r\n]+/).map(item => item.trim()).filter(Boolean)) {
    const displayName = line
      .replace(/^\s*(?:[-•]\s*)?(?:\d+[.)、]\s*)?/, '')
      .replace(/\s*[–—-]\s*(?:Trưởng ban|Phó trưởng ban|Thành viên)\s*$/i, '')
      .trim();
    const normalizedLine = normalize(line);
    const person = staff.find(candidate => {
      const normalizedName = normalize(candidate.HoTen);
      return normalizedName.length > 2 && normalizedLine.includes(normalizedName);
    });
    if (!person || seen.has(Number(person.MaTK))) continue;
    seen.add(Number(person.MaTK));
    members.push({
      maTK: Number(person.MaTK),
      hoTen: displayName || person.HoTen,
      vaiTro: /phó\s+trưởng\s+ban/i.test(line) ? 'Phó trưởng ban' : /trưởng\s+ban/i.test(line) ? 'Trưởng ban' : 'Thành viên',
    });
  }
  if (!members.length) return committees;
  if (existing) {
    const existingIds = new Set(existing.thanhVien.map(member => Number(member.maTK)));
    existing.thanhVien.push(...members.filter(member => !existingIds.has(Number(member.maTK))));
    return committees;
  }
  return [...committees, { loaiBan: 'CHAM_THI', tenBan: 'Ban giám khảo', thanhVien: members }];
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
  if (submitting) {
    const requiredKinds = competition ? ['TO_CHUC', 'DE_THI', 'CHAM_THI'] : ['TO_CHUC'];
    const kindLabels: Record<string, string> = {
      TO_CHUC: 'Ban tổ chức',
      DE_THI: 'Ban đề thi',
      CHAM_THI: 'Ban giám khảo',
    };
    const missingKinds = requiredKinds.filter((kind) => !kinds.has(kind));
    if (missingKinds.length) {
      const missingNames = missingKinds.map((kind) => kindLabels[kind]);
      throw new BadRequestException(`Chưa nhận diện ${missingNames.join(', ')} trong dữ liệu đã lưu. Hãy kiểm tra tên ban, bấm Lưu phân công thực hiện rồi trình ký lại.`);
    }
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
