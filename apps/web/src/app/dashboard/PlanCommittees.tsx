"use client";

import { useId, useMemo, useState } from "react";
import s from "./dashboard.module.css";

export type Assignment = {
  maTK: number;
  hoTen?: string;
  chucDanh?: string;
  vaiTro: string;
  nhiemVu?: string;
  hanHoanThanh?: string;
  sanPham?: string;
};

export type Committee = {
  loaiBan?: string;
  tenBan: string;
  nhiemVu?: string;
  thanhVien: Assignment[];
};

export type WorkItem = {
  id?: string;
  stt: number;
  noiDung: string;
  thoiGian: string;
  maTK: number;
  hoTen?: string;
};

export type PlanStaff = {
  MaTK: number;
  MaNgDung?: number;
  HoTen: string;
  TenBM?: string | null;
  MaBM?: number | null;
  HocVi?: string | null;
  ChucDanh?: string | null;
  ChucVu?: string | null;
};

export const STANDARD_BAN_NAMES = [
  "Ban chỉ đạo",
  "Ban tổ chức",
  "Ban đề thi",
  "Ban thư ký",
  "Ban giám khảo",
  "Ban hậu cần",
  "Ban truyền thông",
] as const;

export function formatAcademicTitle(hocVi?: string | null): string {
  if (!hocVi) return "";
  const norm = (hocVi + "")
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (norm.includes("pho giao su") || norm.includes("pgs")) {
    if (norm.includes("tien si") || norm.includes("ts")) return "PGS.TS.";
    return "PGS.";
  }
  if (norm.includes("giao su") || norm.includes("gs")) {
    if (norm.includes("tien si") || norm.includes("ts")) return "GS.TS.";
    return "GS.";
  }
  if (norm.includes("tien si") || norm.includes("ts")) {
    return "TS.";
  }
  if (norm.includes("thac si") || norm.includes("ths")) {
    return "ThS.";
  }
  if (norm.includes("ky su") || norm.includes("ks")) {
    return "KS.";
  }
  if (norm.includes("cu nhan") || norm.includes("cn")) {
    return "CN.";
  }
  return "";
}

export function formatTeacherName(hoTen: string, hocVi?: string | null): string {
  if (!hoTen) return "";
  if (hoTen.includes(";")) {
    return hoTen
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .join("; ");
  }
  const prefix = formatAcademicTitle(hocVi);
  if (!prefix) return hoTen;
  if (/^(PGS\.TS\.|GS\.TS\.|PGS\.|GS\.|TS\.|ThS\.|KS\.|CN\.)\s+/i.test(hoTen)) {
    return hoTen;
  }
  return `${prefix} ${hoTen}`;
}

function isSteeringCommittee(name: string): boolean {
  const norm = (name || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return norm.includes("chi dao");
}

function getFacultyLeaders(staff: PlanStaff[]): PlanStaff[] {
  const leaders = staff.filter((s) => {
    const cv = ((s.ChucVu || s.ChucDanh || "") + "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return cv.includes("truong khoa") || cv.includes("pho truong khoa") || cv.includes("pho khoa");
  });
  return leaders.length > 0 ? leaders : staff;
}

function getDepartmentStaff(staff: PlanStaff[], departmentId?: number | null): PlanStaff[] {
  if (departmentId != null && departmentId > 0) {
    const dept = staff.filter((s) => s.MaBM === Number(departmentId));
    if (dept.length > 0) return dept;
  }
  return staff;
}

type CommitteeMember = {
  id: string;
  maTK: number;
  hoTen: string;
  chucDanh: string;
  chucVu: string;
};

type CommitteeGroup = {
  id: string;
  tenBan: string;
  isCustomBan: boolean;
  members: CommitteeMember[];
};


function normalizeName(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/^(pgs\.ts\.|gs\.ts\.|pgs\.|gs\.|ts\.|ths\.|ks\.|cn\.)\s+/i, "")
    .trim();
}

function parseLecturerNames(hoTenStr: string): string[] {
  if (!hoTenStr) return [];
  return hoTenStr
    .split(";")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isLecturerSelected(item: WorkItemRow, person: PlanStaff): boolean {
  if (!item.hoTen) return false;
  const selectedNorms = parseLecturerNames(item.hoTen).map(normalizeName);
  const personNorm = normalizeName(person.HoTen);
  return selectedNorms.includes(personNorm);
}

export type DepartmentStaffGroup = {
  departmentName: string;
  isCurrentDept: boolean;
  lecturers: PlanStaff[];
};

export function groupStaffByDepartment(
  staff: PlanStaff[],
  currentDepartmentId?: number | null
): DepartmentStaffGroup[] {
  const map = new Map<string, { isCurrentDept: boolean; lecturers: PlanStaff[] }>();
  const seenMaTK = new Set<number>();

  for (const person of staff) {
    if (!person.MaTK || !person.HoTen) continue;
    if (seenMaTK.has(person.MaTK)) continue;
    seenMaTK.add(person.MaTK);

    const isCurrent = currentDepartmentId != null && Number(person.MaBM) === Number(currentDepartmentId);
    let deptName = person.TenBM?.trim();
    if (!deptName) {
      deptName = "Ban Chủ nhiệm Khoa / Cán bộ Khoa";
    } else if (!deptName.toLowerCase().startsWith("bộ môn")) {
      deptName = `Bộ môn ${deptName}`;
    }

    if (!map.has(deptName)) {
      map.set(deptName, { isCurrentDept: isCurrent, lecturers: [] });
    }
    const group = map.get(deptName)!;
    if (isCurrent) group.isCurrentDept = true;
    group.lecturers.push(person);
  }

  for (const group of map.values()) {
    group.lecturers.sort((a, b) => a.HoTen.localeCompare(b.HoTen, "vi"));
  }

  const groups: DepartmentStaffGroup[] = Array.from(map.entries()).map(([deptName, val]) => ({
    departmentName: deptName,
    isCurrentDept: val.isCurrentDept,
    lecturers: val.lecturers,
  }));

  groups.sort((a, b) => {
    if (a.isCurrentDept && !b.isCurrentDept) return -1;
    if (!a.isCurrentDept && b.isCurrentDept) return 1;
    return a.departmentName.localeCompare(b.departmentName, "vi");
  });

  return groups;
}

type WorkItemRow = {
  id: string;
  stt: number;
  noiDung: string;
  thoiGian: string;
  maTK: number;
  hoTen: string;
};

export function PlanCommitteesSummary({
  committees = [],
  workItems = [],
  staff = [],
}: {
  committees: Committee[];
  workItems?: WorkItem[];
  staff: PlanStaff[];
}) {
  let globalStt = 1;
  const hasMembers = committees.some((c) => c.thanhVien && c.thanhVien.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h3 style={{ margin: "0 0 10px", color: "#183d70", fontSize: "15px", fontWeight: 700 }}>
          Các ban và nhân sự
        </h3>
        {!hasMembers ? (
          <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "13px" }}>Chưa lập các ban.</p>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflowX: "auto" }}>
            <table style={{ margin: 0, width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ width: "48px", padding: "8px 6px", border: "1px solid #e2e8f0", textAlign: "center", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>STT</th>
                  <th style={{ width: "18%", padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Tên ban</th>
                  <th style={{ width: "26%", padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Họ tên</th>
                  <th style={{ width: "26%", padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Chức danh</th>
                  <th style={{ width: "26%", padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Chức vụ (trong ban)</th>
                </tr>
              </thead>
              <tbody>
                {committees.map((c, cIdx) => {
                  const members = c.thanhVien || [];
                  if (!members.length) return null;
                  const rowSpanCount = members.length;
                  return members.map((m, mIdx) => {
                    const found = staff.find((p) => Number(p.MaTK) === Number(m.maTK));
                    const rawName = m.hoTen || found?.HoTen || `Tài khoản #${m.maTK}`;
                    return (
                      <tr key={`${cIdx}-${mIdx}`}>
                        <td style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #e2e8f0", color: "#64748b", boxSizing: "border-box" }}>
                          {globalStt++}
                        </td>
                        {mIdx === 0 && (
                          <td
                            rowSpan={rowSpanCount}
                            style={{
                              padding: "8px 12px",
                              border: "1px solid #e2e8f0",
                              boxSizing: "border-box",
                              verticalAlign: "middle",
                              background: "#ffffff",
                              fontWeight: 600,
                              color: "#1e293b",
                            }}
                          >
                            {c.tenBan}
                          </td>
                        )}
                        <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0", boxSizing: "border-box" }}>
                          {formatTeacherName(rawName, found?.HocVi)}
                        </td>
                        <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0", color: "#64748b", boxSizing: "border-box" }}>
                          {(m as any).chucDanh || found?.ChucVu || found?.ChucDanh || "Giảng viên"}
                        </td>
                        <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0", boxSizing: "border-box" }}>
                          {m.vaiTro || m.nhiemVu || "Thành viên"}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 style={{ margin: "0 0 10px", color: "#183d70", fontSize: "15px", fontWeight: 700 }}>
          Phân công nội dung thực hiện
        </h3>
        {!workItems.length ? (
          <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "13px" }}>Chưa có nội dung thực hiện được phân công.</p>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflowX: "auto" }}>
            <table style={{ margin: 0, width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ width: "5%", padding: "8px 6px", border: "1px solid #e2e8f0", textAlign: "center", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>STT</th>
                  <th style={{ width: "35%", padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Nội dung</th>
                  <th style={{ width: "22%", padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Thời gian hoàn thành</th>
                  <th style={{ width: "38%", padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Phân công thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {workItems.map((w, idx) => {
                  const person = staff.find((p) => Number(p.MaTK) === Number(w.maTK));
                  const rawName = w.hoTen || person?.HoTen || (w.maTK ? `Tài khoản #${w.maTK}` : "Chưa phân công");
                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #e2e8f0", color: "#64748b", boxSizing: "border-box" }}>{w.stt ?? idx + 1}</td>
                      <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0", whiteSpace: "pre-wrap", boxSizing: "border-box" }}>{w.noiDung}</td>
                      <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0", boxSizing: "border-box" }}>{w.thoiGian ? new Date(w.thoiGian).toLocaleDateString("vi-VN") : "Chưa đặt"}</td>
                      <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0", boxSizing: "border-box" }}>{w.hoTen || (person ? formatTeacherName(person.HoTen, person.HocVi) : "Chưa phân công")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanCommitteesEditor({
  initial = [],
  initialWorkItems = [],
  staff = [],
  departmentId,
  busy = false,
  onDirty,
}: {
  initial: Committee[];
  initialWorkItems?: WorkItem[];
  staff: PlanStaff[];
  departmentId?: number | null;
  departmentName?: string | null;
  busy: boolean;
  onDirty: () => void;
}) {
  const baseId = useId();

  // 1. Initialize Committee Groups from initial committees
  const [committees, setCommittees] = useState<CommitteeGroup[]>(() => {
    if (initial && initial.length > 0) {
      return initial.map((c, cIdx) => {
        const isStandard = STANDARD_BAN_NAMES.includes(c.tenBan as any);
        const members: CommitteeMember[] =
          c.thanhVien && c.thanhVien.length > 0
            ? c.thanhVien.map((m, mIdx) => {
                const person = staff.find((p) => Number(p.MaTK) === Number(m.maTK));
                const rawName = m.hoTen || person?.HoTen || "";
                return {
                  id: `init-mem-${cIdx}-${mIdx}`,
                  maTK: m.maTK,
                  hoTen: formatTeacherName(rawName, person?.HocVi),
                  chucDanh: (m as any).chucDanh || person?.ChucVu || person?.ChucDanh || "Giảng viên",
                  chucVu: m.vaiTro || m.nhiemVu || (mIdx === 0 ? "Trưởng ban" : "Thành viên"),
                };
              })
            : [
                {
                  id: `init-mem-${cIdx}-0`,
                  maTK: 0,
                  hoTen: "",
                  chucDanh: "",
                  chucVu: "Trưởng ban",
                },
              ];

        return {
          id: `init-comm-${cIdx}`,
          tenBan: c.tenBan,
          isCustomBan: !isStandard,
          members,
        };
      });
    }

    return [
      {
        id: "init-comm-0",
        tenBan: "Ban chỉ đạo",
        isCustomBan: false,
        members: [
          {
            id: "init-mem-0-0",
            maTK: 0,
            hoTen: "",
            chucDanh: "",
            chucVu: "Trưởng ban",
          },
        ],
      },
    ];
  });

  // 2. Initialize Work Item Rows from initialWorkItems
  const [workItems, setWorkItems] = useState<WorkItemRow[]>(() => {
    if (initialWorkItems && initialWorkItems.length > 0) {
      return initialWorkItems.map((w, i) => {
        const person = staff.find((p) => Number(p.MaTK) === Number(w.maTK));
        const rawName = w.hoTen || person?.HoTen || "";
        return {
          id: `init-work-${i}`,
          stt: w.stt ?? i + 1,
          noiDung: w.noiDung || "",
          thoiGian: w.thoiGian ? w.thoiGian.slice(0, 10) : "",
          maTK: w.maTK || 0,
          hoTen: formatTeacherName(rawName, person?.HocVi),
        };
      });
    }
    return [
      {
        id: "init-work-0",
        stt: 1,
        noiDung: "",
        thoiGian: "",
        maTK: 0,
        hoTen: "",
      },
    ];
  });

  const facultyLeaders = getFacultyLeaders(staff);
  const departmentStaff = getDepartmentStaff(staff, departmentId);
  const groupedStaff = useMemo(() => groupStaffByDepartment(staff, departmentId), [staff, departmentId]);

  function toggleWorkItemLecturer(itemIndex: number, person: PlanStaff) {
    notifyChange();
    const item = workItems[itemIndex];
    if (!item) return;

    const currentlySelected = staff.filter((p) => isLecturerSelected(item, p));
    const isAlready = currentlySelected.some((p) => p.MaTK === person.MaTK);

    let nextSelected: PlanStaff[];
    if (isAlready) {
      nextSelected = currentlySelected.filter((p) => p.MaTK !== person.MaTK);
    } else {
      nextSelected = [...currentlySelected, person];
    }

    const nextHoTen = nextSelected.map((p) => formatTeacherName(p.HoTen, p.HocVi)).join("; ");
    const nextMaTK = nextSelected.length > 0 ? nextSelected[0].MaTK : 0;

    updateWorkItemRow(itemIndex, {
      hoTen: nextHoTen,
      maTK: nextMaTK,
    });
  }

  function notifyChange() {
    onDirty();
  }

  // --- Committee Handlers ---
  function addCommittee() {
    notifyChange();
    const isFirst = committees.length === 0;
    const defaultBan = isFirst ? "Ban chỉ đạo" : "Ban tổ chức";
    setCommittees((prev) => [
      ...prev,
      {
        id: `${baseId}-comm-${Date.now()}-${Math.random()}`,
        tenBan: defaultBan,
        isCustomBan: false,
        members: [
          {
            id: `${baseId}-mem-${Date.now()}-${Math.random()}`,
            maTK: 0,
            hoTen: "",
            chucDanh: "",
            chucVu: "Trưởng ban",
          },
        ],
      },
    ]);
  }

  function updateCommittee(committeeIndex: number, updates: Partial<CommitteeGroup>) {
    notifyChange();
    setCommittees((prev) =>
      prev.map((c, i) => {
        if (i !== committeeIndex) return c;
        const updated = { ...c, ...updates };
        if (updates.tenBan !== undefined) {
          const isSteering = isSteeringCommittee(updated.tenBan);
          const validList = isSteering ? facultyLeaders : departmentStaff;
          updated.members = updated.members.map((m) => {
            if (m.maTK > 0 && !validList.some((p) => Number(p.MaTK) === m.maTK)) {
              return { ...m, maTK: 0, hoTen: "", chucDanh: "" };
            }
            return m;
          });
        }
        return updated;
      })
    );
  }

  function addMemberToCommittee(committeeIndex: number, afterMemberIndex?: number) {
    notifyChange();
    setCommittees((prev) =>
      prev.map((c, i) => {
        if (i !== committeeIndex) return c;
        const hasHead = c.members.some((m) => m.chucVu.trim().toLowerCase() === "trưởng ban");
        const hasVice = c.members.some(
          (m) =>
            m.chucVu.trim().toLowerCase() === "phó ban" ||
            m.chucVu.trim().toLowerCase() === "phó trưởng ban"
        );
        const defaultRole = !hasHead ? "Trưởng ban" : !hasVice ? "Phó ban" : "Thành viên";
        const newMember: CommitteeMember = {
          id: `${baseId}-mem-${Date.now()}-${Math.random()}`,
          maTK: 0,
          hoTen: "",
          chucDanh: "",
          chucVu: defaultRole,
        };
        const nextMembers = [...c.members];
        if (afterMemberIndex !== undefined) {
          nextMembers.splice(afterMemberIndex + 1, 0, newMember);
        } else {
          nextMembers.push(newMember);
        }
        return { ...c, members: nextMembers };
      })
    );
  }

  function removeMember(committeeIndex: number, memberIndex: number) {
    notifyChange();
    setCommittees((prev) => {
      const c = prev[committeeIndex];
      if (!c) return prev;
      if (c.members.length > 1) {
        return prev.map((item, idx) =>
          idx === committeeIndex
            ? { ...item, members: item.members.filter((_, mIdx) => mIdx !== memberIndex) }
            : item
        );
      }
      if (prev.length > 1) {
        return prev.filter((_, idx) => idx !== committeeIndex);
      }
      return [
        {
          ...c,
          members: [
            {
              id: `${baseId}-mem-${Date.now()}-${Math.random()}`,
              maTK: 0,
              hoTen: "",
              chucDanh: "",
              chucVu: "Trưởng ban",
            },
          ],
        },
      ];
    });
  }

  function updateMember(committeeIndex: number, memberIndex: number, updates: Partial<CommitteeMember>) {
    notifyChange();
    setCommittees((prev) =>
      prev.map((c, cIdx) => {
        if (cIdx !== committeeIndex) return c;
        const updatedMembers = c.members.map((m, mIdx) =>
          mIdx === memberIndex ? { ...m, ...updates } : m
        );
        return { ...c, members: updatedMembers };
      })
    );
  }

  function handlePersonSelect(committeeIndex: number, memberIndex: number, maTK: number, isSteering: boolean) {
    const list = isSteering ? facultyLeaders : departmentStaff;
    const person = list.find((p) => Number(p.MaTK) === Number(maTK));
    if (person) {
      updateMember(committeeIndex, memberIndex, {
        maTK: person.MaTK,
        hoTen: formatTeacherName(person.HoTen, person.HocVi),
        chucDanh: person.ChucVu || person.ChucDanh || "Giảng viên",
      });
    } else {
      updateMember(committeeIndex, memberIndex, {
        maTK: 0,
        hoTen: "",
        chucDanh: "",
      });
    }
  }

  // --- Work Items Handlers ---
  function addWorkItemRow() {
    notifyChange();
    setWorkItems((prev) => [
      ...prev,
      {
        id: `${baseId}-work-${Date.now()}-${Math.random()}`,
        stt: prev.length + 1,
        noiDung: "",
        thoiGian: "",
        maTK: 0,
        hoTen: "",
      },
    ]);
  }

  function removeWorkItemRow(index: number) {
    notifyChange();
    setWorkItems((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, idx) => ({ ...item, stt: idx + 1 }))
    );
  }

  function updateWorkItemRow(index: number, updates: Partial<WorkItemRow>) {
    notifyChange();
    setWorkItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...updates } : row))
    );
  }

  // --- Prepare JSON payloads for form submit ---
  const serializedCacBan = committees
    .filter((c) => c.tenBan.trim())
    .map((c) => {
      let loaiBan = "KHAC";
      const tb = c.tenBan.trim();
      const normTb = tb
        .toLowerCase()
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normTb.includes("chi dao")) loaiBan = "CHI_DAO";
      else if (normTb.includes("to chuc")) loaiBan = "TO_CHUC";
      else if (normTb.includes("de thi") || normTb.includes("ra de")) loaiBan = "DE_THI";
      else if (normTb.includes("thu ky")) loaiBan = "THU_KY";
      else if (normTb.includes("giam khao") || normTb.includes("cham thi")) loaiBan = "CHAM_THI";
      else if (normTb.includes("hau can")) loaiBan = "HAU_CAN";
      else if (normTb.includes("truyen thong")) loaiBan = "TRUYEN_THONG";

      return {
        tenBan: tb,
        loaiBan,
        thanhVien: c.members
          .filter((m) => m.maTK > 0)
          .map((m) => ({
            maTK: m.maTK,
            hoTen: m.hoTen,
            chucDanh: m.chucDanh,
            vaiTro: m.chucVu.trim() || "Thành viên",
            nhiemVu: m.chucVu.trim() || "Nhiệm vụ trong ban",
          })),
      };
    });

  const serializedWorkItems = workItems
    .filter((w) => w.noiDung.trim() || w.maTK > 0 || (w.hoTen && w.hoTen.trim()))
    .map((w, idx) => {
      const person = staff.find((p) => Number(p.MaTK) === Number(w.maTK));
      return {
        stt: idx + 1,
        noiDung: w.noiDung.trim(),
        thoiGian: w.thoiGian || undefined,
        maTK: w.maTK || undefined,
        hoTen: (w.hoTen && w.hoTen.trim()) || (person ? formatTeacherName(person.HoTen, person.HocVi) : undefined),
      };
    });

  return (
    <fieldset className={s.planCommittees} disabled={busy} style={{ border: "none", padding: 0, margin: 0 }}>
      {/* Hidden inputs for formData serialization */}
      <input type="hidden" name="cacBan" value={JSON.stringify(serializedCacBan)} />
      <input type="hidden" name="noiDungThucHien" value={JSON.stringify(serializedWorkItems)} />

      {/* SECTION 1: Các ban và nhân sự */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "8px" }}>
          <button
            type="button"
            className={s.secondaryButton}
            onClick={addCommittee}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 500,
              padding: "6px 12px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
            }}
          >
            <span>+ Thêm ban</span>
          </button>
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflowX: "auto" }}>
          <table style={{ margin: 0, width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ width: "18%", padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Tên ban</th>
                <th style={{ width: "24.5%", padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Họ tên</th>
                <th style={{ width: "24.5%", padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Chức danh</th>
                <th style={{ width: "24.5%", padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Chức vụ (trong ban)</th>
                <th style={{ width: "8.5%", padding: "8px 6px", border: "1px solid #e2e8f0", textAlign: "center", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {committees.map((committee, cIdx) => {
                const isSteering = isSteeringCommittee(committee.tenBan);
                const availableStaff = isSteering ? facultyLeaders : departmentStaff;
                const rowSpanCount = committee.members.length;

                return committee.members.map((member, mIdx) => (
                  <tr key={member.id}>
                    {/* 1. Tên ban (CHỈ HIỂN THỊ Ở DÒNG ĐẦU TIÊN VỚI rowSpan, các dòng sau chung ô này) */}
                    {mIdx === 0 && (
                      <td
                        rowSpan={rowSpanCount}
                        style={{
                          padding: "8px 10px",
                          border: "1px solid #e2e8f0",
                          verticalAlign: "middle",
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <select
                            className={s.businessInput}
                            style={{
                              padding: "6px 8px",
                              fontSize: "13px",
                              width: "100%",
                              boxSizing: "border-box",
                              border: "1px solid #cbd5e1",
                              borderRadius: "5px",
                            }}
                            value={committee.isCustomBan ? "KHAC" : committee.tenBan}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "KHAC") {
                                updateCommittee(cIdx, { isCustomBan: true, tenBan: "" });
                              } else {
                                updateCommittee(cIdx, { isCustomBan: false, tenBan: val });
                              }
                            }}
                          >
                            {STANDARD_BAN_NAMES.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                            <option value="KHAC">Khác (Nhập tay)...</option>
                          </select>
                          {committee.isCustomBan && (
                            <input
                              type="text"
                              required
                              className={s.businessInput}
                              style={{
                                padding: "6px 8px",
                                fontSize: "13px",
                                width: "100%",
                                boxSizing: "border-box",
                                border: "1px solid #cbd5e1",
                                borderRadius: "5px",
                              }}
                              placeholder="Nhập tên ban..."
                              value={committee.tenBan}
                              onChange={(e) => updateCommittee(cIdx, { tenBan: e.target.value })}
                            />
                          )}
                        </div>
                      </td>
                    )}

                    {/* 2. Họ tên */}
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", verticalAlign: "middle", boxSizing: "border-box" }}>
                      <select
                        className={s.businessInput}
                        style={{ padding: "6px 8px", fontSize: "13px", width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "5px" }}
                        required
                        value={member.maTK || ""}
                        onChange={(e) => handlePersonSelect(cIdx, mIdx, Number(e.target.value), isSteering)}
                      >
                        <option value="">
                          {isSteering ? "Chọn Lãnh đạo Khoa…" : "Chọn Giảng viên bộ môn…"}
                        </option>
                        {availableStaff.map((person) => {
                          const formattedName = formatTeacherName(person.HoTen, person.HocVi);
                          return (
                            <option key={person.MaTK} value={person.MaTK}>
                              {formattedName}
                            </option>
                          );
                        })}
                      </select>
                    </td>

                    {/* 3. Chức danh */}
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", verticalAlign: "middle", boxSizing: "border-box" }}>
                      <input
                        type="text"
                        className={s.businessInput}
                        style={{ padding: "6px 8px", fontSize: "13px", width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "5px" }}
                        placeholder="Chức danh..."
                        value={member.chucDanh}
                        onChange={(e) => updateMember(cIdx, mIdx, { chucDanh: e.target.value })}
                      />
                    </td>

                    {/* 4. Chức vụ (trong ban, cho nhập tay) */}
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", verticalAlign: "middle", boxSizing: "border-box" }}>
                      <input
                        type="text"
                        required
                        className={s.businessInput}
                        style={{ padding: "6px 8px", fontSize: "13px", width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "5px" }}
                        placeholder="Trưởng ban, Phó ban, Ủy viên..."
                        value={member.chucVu}
                        onChange={(e) => updateMember(cIdx, mIdx, { chucVu: e.target.value })}
                      />
                    </td>

                    {/* 5. Thao tác */}
                    <td style={{ textAlign: "center", verticalAlign: "middle", padding: "8px 6px", border: "1px solid #e2e8f0", boxSizing: "border-box" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => addMemberToCommittee(cIdx, mIdx)}
                          style={{
                            background: "#f0fdf4",
                            border: "1px solid #86efac",
                            color: "#16a34a",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "3px 6px",
                            borderRadius: "4px",
                            transition: "background 0.15s, color 0.15s",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "2px",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#dcfce7";
                            e.currentTarget.style.borderColor = "#4ade80";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f0fdf4";
                            e.currentTarget.style.borderColor = "#86efac";
                          }}
                          title={`Thêm dòng người vào ${committee.tenBan || "ban này"}`}
                        >
                          ➕
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMember(cIdx, mIdx)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            fontSize: "15px",
                            padding: "3px",
                            borderRadius: "4px",
                            transition: "color 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                          title="Xóa dòng này"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Phân công nội dung thực hiện */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, color: "#183d70", fontSize: "15px", fontWeight: 700 }}>
              Phân công nội dung thực hiện
            </h3>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Nội dung công việc và phân công giảng viên bộ môn thực hiện
            </span>
          </div>
          <button
            type="button"
            className={s.secondaryButton}
            onClick={addWorkItemRow}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 500,
              padding: "6px 12px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
            }}
          >
            <span>+ Thêm nội dung</span>
          </button>
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", overflowX: "auto" }}>
          <table style={{ margin: 0, width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ width: "5%", padding: "8px 6px", border: "1px solid #e2e8f0", textAlign: "center", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>STT</th>
                <th style={{ width: "35%", padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Nội dung</th>
                <th style={{ width: "22%", padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Thời gian hoàn thành</th>
                <th style={{ width: "33%", padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Phân công thực hiện</th>
                <th style={{ width: "5%", padding: "8px 6px", border: "1px solid #e2e8f0", textAlign: "center", color: "#475569", fontWeight: 600, boxSizing: "border-box" }}>Xóa</th>
              </tr>
            </thead>
            <tbody>
              {workItems.map((item, index) => (
                <tr key={item.id}>
                  {/* STT */}
                  <td style={{ textAlign: "center", fontWeight: 600, color: "#64748b", padding: "8px 6px", border: "1px solid #e2e8f0", verticalAlign: "middle", boxSizing: "border-box" }}>
                    {index + 1}
                  </td>

                  {/* Nội dung (dài đến đầu cột chức danh của bảng 1) */}
                  <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", verticalAlign: "middle", boxSizing: "border-box" }}>
                    <textarea
                      rows={2}
                      required
                      className={s.businessInput}
                      style={{ padding: "6px 8px", fontSize: "13px", resize: "vertical", width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "5px" }}
                      placeholder="Nhập nội dung công việc..."
                      value={item.noiDung}
                      onChange={(e) => updateWorkItemRow(index, { noiDung: e.target.value })}
                    />
                  </td>

                  {/* Thời gian hoàn thành */}
                  <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", verticalAlign: "middle", boxSizing: "border-box" }}>
                    <input
                      type="date"
                      className={s.businessInput}
                      style={{ padding: "6px 8px", fontSize: "13px", width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "5px" }}
                      value={item.thoiGian}
                      onChange={(e) => updateWorkItemRow(index, { thoiGian: e.target.value })}
                    />
                  </td>

                  {/* Phân công thực hiện (dạng selection, chọn nhiều giảng viên ngăn cách bằng dấu ;) */}
                  <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", verticalAlign: "middle", boxSizing: "border-box" }}>
                    <select
                      className={s.businessInput}
                      style={{
                        padding: "6px 8px",
                        fontSize: "13px",
                        width: "100%",
                        boxSizing: "border-box",
                        border: "1px solid #cbd5e1",
                        borderRadius: "5px",
                      }}
                      value={item.hoTen ? "__CURRENT__" : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__CLEAR__") {
                          notifyChange();
                          updateWorkItemRow(index, { hoTen: "", maTK: 0 });
                          return;
                        }
                        if (val.startsWith("TOGGLE_")) {
                          const maTK = Number(val.replace("TOGGLE_", ""));
                          const person = staff.find((p) => p.MaTK === maTK);
                          if (person) {
                            toggleWorkItemLecturer(index, person);
                          }
                        }
                      }}
                    >
                      {item.hoTen ? (
                        <>
                          <option value="__CURRENT__">{item.hoTen}</option>
                          <option value="" disabled>
                            ── Chọn thêm / bỏ chọn (ngăn cách bằng &quot;;&quot;) ──
                          </option>
                        </>
                      ) : (
                        <option value="">Chọn giảng viên thực hiện…</option>
                      )}
                      {groupedStaff.map((group) => (
                        <optgroup
                          key={group.departmentName}
                          label={group.departmentName + (group.isCurrentDept ? " (Bộ môn phụ trách)" : "")}
                        >
                          {group.lecturers.map((person) => {
                            const formattedName = formatTeacherName(person.HoTen, person.HocVi);
                            const isSelected = isLecturerSelected(item, person);
                            return (
                              <option key={person.MaTK} value={`TOGGLE_${person.MaTK}`}>
                                {isSelected ? `✓ ${formattedName} (Bỏ chọn)` : item.hoTen ? `+ ${formattedName}` : formattedName}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                      {item.hoTen && (
                        <>
                          <option value="" disabled>
                            ──────────────────────────────
                          </option>
                          <option value="__CLEAR__">✕ Xóa tất cả (chọn lại từ đầu)</option>
                        </>
                      )}
                    </select>
                  </td>

                  {/* Nút xóa */}
                  <td style={{ textAlign: "center", verticalAlign: "middle", padding: "8px 6px", border: "1px solid #e2e8f0", boxSizing: "border-box" }}>
                    <button
                      type="button"
                      onClick={() => removeWorkItemRow(index)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#94a3b8",
                        cursor: "pointer",
                        fontSize: "15px",
                        padding: "4px",
                        borderRadius: "4px",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                      title="Xóa công việc này"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </fieldset>
  );
}
