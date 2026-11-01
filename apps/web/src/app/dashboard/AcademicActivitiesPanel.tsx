"use client";

import React, { useState, useEffect, useMemo } from "react";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import { canManageActivities } from "./sections";
import s from "./dashboard.module.css";
import NoticeDialog from "./NoticeDialog";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const val = row[key];
  if (val === undefined || val === null || val === "") return "—";
  return String(val);
}

function value(row: Row, key: string): string | number {
  const val = row[key];
  if (typeof val === "number") return val;
  if (typeof val === "string") return val;
  return "";
}

function formatDate(val: unknown): string {
  if (!val) return "—";
  const raw = String(val);
  // The database field is NVARCHAR now: format ISO dates for readability,
  // but leave free-form schedule text untouched.
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)) return raw;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return raw;
  }
}

interface AcademicActivitiesPanelProps {
  view?: "activities" | "steering" | "organizing" | "support";
  user?: AuthUser;
  onNavigateTab?: (tab: "activities" | "steering" | "organizing" | "support") => void;
  onNavigateExpenses?: (activityId: number, activityName: string) => void;
}

const PAGE_SIZE = 10;

export default function AcademicActivitiesPanel({ view = "activities", user, onNavigateExpenses }: AcademicActivitiesPanelProps) {
  const [activeTab, setActiveTab] = useState<"activities" | "steering" | "organizing" | "support">(view);
  const [activities, setActivities] = useState<Row[]>([]);
  const [nextActivityId, setNextActivityId] = useState(1);
  const [departments, setDepartments] = useState<Row[]>([]);
  const [steeringMembers, setSteeringMembers] = useState<Row[]>([]);
  const [organizingMembers, setOrganizingMembers] = useState<Row[]>([]);
  const [supportMembers, setSupportMembers] = useState<Row[]>([]);
  const [staffRecords, setStaffRecords] = useState<Row[]>([]);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Filters & Search
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal: Create / Edit Activity
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Row | null>(null);
  const [viewingActivity, setViewingActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({
    hocKy: "",
    namHoc: "",
    tgBatDau: "",
    tgKetThuc: "",
    tgDuKien: new Date().toISOString().slice(0, 10),
    maBM: "" as string | number,
    capTC: "Cấp Khoa/Liên bộ môn",
    tenHoatDong: "",
    loaiHoatDong: "Cuộc thi" as "Cuộc thi" | "Seminar" | "Workshop" | "Tọa đàm",
    noiDung: "",
    diaDiem: "",
    tienDoTH: "Đang chuẩn bị",
    doiTuongThamDu: "Sinh viên Khoa CNTT",
    slsvDuKien: "50",
    trangThai: "Dự thảo",
  });

  // Modal: Add Committee Member
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Row | null>(null);
  const [budgetActivity, setBudgetActivity] = useState<Row | null>(null);
  const [memberForm, setMemberForm] = useState({
    maHD: 0,
    maNgDung: 0,
    hoTen: "",
    hocVi: "",
    chucDanh: "",
    chucVu: "",
    nhiemVu: "",
  });

  // Keep activeTab in sync with view prop
  useEffect(() => {
    setActiveTab(view);
  }, [view]);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [acts, depts, st, og, sp, nextId, staff] = await Promise.all([
        workflowRequest<Row[]>("/academic-activities"),
        workflowRequest<{departments:Row[]}>("/plans/units").then(value => value.departments).catch(() => []),
        workflowRequest<Row[]>("/academic-activities/steering-committee").catch(() => []),
        workflowRequest<Row[]>("/academic-activities/organizing-committee").catch(() => []),
        workflowRequest<Row[]>("/academic-activities/support-committee").catch(() => []),
        workflowRequest<{ nextId: number }>("/academic-activities/next-id").catch(() => ({ nextId: 1 })),
        workflowRequest<Row[]>("/admin/accounts/staff-records").catch(() => []),
      ]);
      setActivities(Array.isArray(acts) ? acts : []);
      setNextActivityId(Number(nextId.nextId) || 1);
      setDepartments(Array.isArray(depts) ? depts : []);
      setSteeringMembers(Array.isArray(st) ? st : []);
      setOrganizingMembers(Array.isArray(og) ? og : []);
      setSupportMembers(Array.isArray(sp) ? sp : []);
      setStaffRecords(Array.isArray(staff) ? staff : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách hoạt động học thuật.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    const list = activities.filter((act) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(value(act, "MaHD")).toLowerCase().includes(q) ||
        text(act, "TenHoatDong").toLowerCase().includes(q) ||
        text(act, "TenBM").toLowerCase().includes(q) ||
        text(act, "DiaDiem").toLowerCase().includes(q) ||
        text(act, "NoiDung").toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterType !== "all" && text(act, "LoaiHoatDong") !== filterType) {
        return false;
      }

      return true;
    });

    return list.sort((a, b) => Number(value(b, "MaHD")) - Number(value(a, "MaHD")));
  }, [activities, search, filterType]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, activeTab, selectedActivityFilter]);

  // Paginated activities
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedActivities = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, safePage]);

  // Filtered Committee Members
  const currentCommitteeList = useMemo(() => {
    let list: Row[] = [];
    if (activeTab === "steering") list = steeringMembers;
    else if (activeTab === "organizing") list = organizingMembers;
    else if (activeTab === "support") list = supportMembers;

    return list.filter((m) => {
      if (selectedActivityFilter !== "all" && String(value(m, "MaHD")) !== selectedActivityFilter) {
        return false;
      }
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        String(value(m, "MaHD")).toLowerCase().includes(q) ||
        text(m, "HoTen").toLowerCase().includes(q) ||
        text(m, "TenHoatDong").toLowerCase().includes(q) ||
        text(m, "ChucVu").toLowerCase().includes(q) ||
        text(m, "ChucDanh").toLowerCase().includes(q) ||
        text(m, "NhiemVu").toLowerCase().includes(q)
      );
    });
  }, [activeTab, steeringMembers, organizingMembers, supportMembers, selectedActivityFilter, search]);

  const totalCommitteePages = Math.max(1, Math.ceil(currentCommitteeList.length / PAGE_SIZE));
  const safeCommitteePage = Math.min(currentPage, totalCommitteePages);
  const paginatedCommittees = useMemo(() => {
    const start = (safeCommitteePage - 1) * PAGE_SIZE;
    return currentCommitteeList.slice(start, start + PAGE_SIZE);
  }, [currentCommitteeList, safeCommitteePage]);

  // Metrics
  const totalCount = activities.length;
  const competitionCount = activities.filter((a) => text(a, "LoaiHoatDong") === "Cuộc thi").length;
  const seminarCount = activities.filter((a) => ["Seminar", "Workshop", "Tọa đàm"].includes(text(a, "LoaiHoatDong"))).length;
  const draftCount = activities.filter((a) => text(a, "TrangThai") === "Dự thảo").length;

  // Open Create Modal
  const openCreateModal = () => {
    setViewingActivity(false);
    setEditingActivity(null);
    let defaultDept: string | number = "";
    if (user?.department) {
      const match = departments.find(
        (d) =>
          text(d, "TenBM").toLowerCase() === user.department?.toLowerCase() ||
          user.department?.toLowerCase().includes(text(d, "TenBM").toLowerCase())
      );
      if (match) defaultDept = Number(value(match, "MaBM"));
    }
    if (!defaultDept && departments.length > 0) {
      defaultDept = Number(value(departments[0], "MaBM"));
    }
    setActivityForm({
      hocKy: "",
      namHoc: "",
      tgBatDau: "",
      tgKetThuc: "",
      tgDuKien: new Date().toISOString().slice(0, 10),
      maBM: defaultDept,
      capTC: "Cấp Khoa/Liên bộ môn",
      tenHoatDong: "",
      loaiHoatDong: "Cuộc thi",
      noiDung: "",
      diaDiem: "",
      tienDoTH: "Đang chuẩn bị",
      doiTuongThamDu: "Sinh viên Khoa CNTT",
      slsvDuKien: "60",
      trangThai: "Dự thảo",
    });
    setIsActivityModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (act: Row) => {
    setViewingActivity(false);
    setEditingActivity(act);
    let dateStr = "";
    setActivityForm({
      hocKy: text(act, "HocKy") !== "—" ? text(act, "HocKy") : "",
      namHoc: text(act, "NamHoc") !== "—" ? text(act, "NamHoc") : "",
      tgBatDau: text(act, "TgBatDau") !== "—" ? text(act, "TgBatDau").slice(0, 5) : "",
      tgKetThuc: text(act, "TgKetThuc") !== "—" ? text(act, "TgKetThuc").slice(0, 5) : "",
      tgDuKien: text(act, "TgDuKien") !== "—" ? text(act, "TgDuKien") : "",
      maBM: value(act, "MaBM") !== "" ? Number(value(act, "MaBM")) : "",
      capTC: text(act, "CapTC") !== "—" ? text(act, "CapTC") : "",
      tenHoatDong: text(act, "TenHoatDong"),
      loaiHoatDong: (text(act, "LoaiHoatDong") as "Cuộc thi" | "Seminar" | "Workshop" | "Tọa đàm") || "Cuộc thi",
      noiDung: text(act, "NoiDung") !== "—" ? text(act, "NoiDung") : "",
      diaDiem: text(act, "DiaDiem") !== "—" ? text(act, "DiaDiem") : "",
      tienDoTH: text(act, "TienDoTH") !== "—" ? text(act, "TienDoTH") : "Đang chuẩn bị",
      doiTuongThamDu: text(act, "DoiTuongThamDu") !== "—" ? text(act, "DoiTuongThamDu") : "Sinh viên Khoa CNTT",
      slsvDuKien: value(act, "SLSVDuKien") == null ? "" : String(value(act, "SLSVDuKien")),
      trangThai: text(act, "TrangThai") !== "—" ? text(act, "TrangThai") : "Dự thảo",
    });
    setIsActivityModalOpen(true);
  };

  const openViewModal = (act: Row) => {
    openEditModal(act);
    setViewingActivity(true);
  };

  // Submit Activity Form
  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.tenHoatDong.trim()) {
      setError("Vui lòng nhập Tên hoạt động.");
      return;
    }
    if (!activityForm.noiDung.trim()) {
      setError("Vui lòng nhập Nội dung hoạt động.");
      return;
    }
    if (!activityForm.doiTuongThamDu.trim()) {
      setError("Vui lòng nhập Đối tượng tham dự.");
      return;
    }
    if (!activityForm.tgDuKien.trim() || activityForm.tgDuKien.length > 225) {
      setError("Vui lòng nhập thời gian dự kiến (tối đa 225 ký tự).");
      return;
    }
    if (!activityForm.slsvDuKien.trim() || activityForm.slsvDuKien.length > 225) {
      setError("Vui lòng nhập số lượng sinh viên dự kiến (tối đa 225 ký tự).");
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (editingActivity) {
        const id = Number(value(editingActivity, "MaHD"));
        await workflowRequest(`/academic-activities/${id}`, {
          method: "PATCH",
          body: {
            hocKy: activityForm.hocKy.trim() || undefined,
            namHoc: activityForm.namHoc.trim() || undefined,
            tgBatDau: activityForm.tgBatDau || undefined,
            tgKetThuc: activityForm.tgKetThuc || undefined,
            tgDuKien: activityForm.tgDuKien || undefined,
            maBM: activityForm.maBM ? Number(activityForm.maBM) : null,
            capTC: activityForm.capTC,
            tenHoatDong: activityForm.tenHoatDong.trim(),
            loaiHoatDong: activityForm.loaiHoatDong,
            noiDung: activityForm.noiDung.trim(),
            diaDiem: activityForm.diaDiem.trim() || undefined,
            tienDoTH: activityForm.tienDoTH.trim() || undefined,
            doiTuongThamDu: activityForm.doiTuongThamDu.trim(),
            slsvDuKien: activityForm.slsvDuKien.trim(),
            trangThai: activityForm.trangThai || "Dự thảo",
          },
        });
        setNotice(`Đã cập nhật hoạt động "${activityForm.tenHoatDong}" thành công.`);
      } else {
        await workflowRequest("/academic-activities", {
          method: "POST",
          body: {
            hocKy: activityForm.hocKy.trim() || undefined,
            namHoc: activityForm.namHoc.trim() || undefined,
            tgBatDau: activityForm.tgBatDau || undefined,
            tgKetThuc: activityForm.tgKetThuc || undefined,
            tgDuKien: activityForm.tgDuKien || undefined,
            maBM: activityForm.maBM ? Number(activityForm.maBM) : null,
            capTC: activityForm.capTC,
            tenHoatDong: activityForm.tenHoatDong.trim(),
            loaiHoatDong: activityForm.loaiHoatDong,
            noiDung: activityForm.noiDung.trim(),
            diaDiem: activityForm.diaDiem.trim() || undefined,
            tienDoTH: activityForm.tienDoTH.trim() || undefined,
            doiTuongThamDu: activityForm.doiTuongThamDu.trim(),
            slsvDuKien: activityForm.slsvDuKien.trim(),
          },
        });
        setNotice(`Đã tạo hoạt động học thuật "${activityForm.tenHoatDong}" thành công.`);
      }
      setIsActivityModalOpen(false);
      setCurrentPage(1);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác không thành công.");
    } finally {
      setBusy(false);
    }
  };

  // Submit Activity for approval
  const handleSubmitApproval = async (act: Row) => {
    const id = Number(value(act, "MaHD"));
    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/academic-activities/${id}/submit`, { method: "PATCH" });
      setNotice("Đã gửi xem xét ký duyệt thành công !\n(Có đính kèm Kinh phí hoạt động)");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi hoạt động sang Ban bộ môn.");
    } finally {
      setBusy(false);
    }
  };

  const normalizedPosition = user?.position?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ?? "";
  const isFacultyLeader = (user?.roles.some((role) => role.toUpperCase() === "TRUONGKHOA") ?? false) || normalizedPosition.includes("truong khoa");

  // Open Member Modal
  const openAddMemberModal = () => {
    setEditingMember(null);
    const defaultActId = activities.length > 0 ? Number(value(activities[0], "MaHD")) : 0;
    setMemberForm({
      maHD: defaultActId,
      maNgDung: 0,
      hoTen: "",
      hocVi: "Thạc sĩ",
      chucDanh: "Giảng viên",
      chucVu: activeTab === "steering" ? "Trưởng ban" : activeTab === "organizing" ? "Trưởng ban" : "Thành viên hỗ trợ",
      nhiemVu: "",
    });
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (m: Row) => {
    setEditingMember(m);
    setMemberForm({
      maHD: Number(value(m, "MaHD")),
      maNgDung: Number(value(m, "MaNgDung")) || 0,
      hoTen: text(m, "HoTen"), hocVi: text(m, "HocVi") === "—" ? "" : text(m, "HocVi"),
      chucDanh: text(m, "ChucDanh") === "—" ? "" : text(m, "ChucDanh"),
      chucVu: text(m, "ChucVu") === "—" ? "" : text(m, "ChucVu"),
      nhiemVu: text(m, "NhiemVu") === "—" ? "" : text(m, "NhiemVu"),
    });
    setIsMemberModalOpen(true);
  };

  const handleStaffNameChange = (name: string) => {
    const staff = staffRecords.find((item) => text(item, "HoTen").toLowerCase() === name.trim().toLowerCase());
    setMemberForm((current) => ({
      ...current,
      hoTen: name,
      ...(staff ? {
        maNgDung: Number(value(staff, "MaNgDung")) || 0,
        hocVi: text(staff, "HocVi") === "—" ? "" : text(staff, "HocVi"),
        chucDanh: text(staff, "ChucVu") === "—" ? "" : text(staff, "ChucVu"),
      } : {}),
    }));
  };

  // Submit Member Form
  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.maHD) {
      setError("Vui lòng chọn Hoạt động học thuật.");
      return;
    }
    if (!memberForm.hoTen.trim()) {
      setError("Vui lòng nhập Họ tên thành viên.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      let endpoint = "/academic-activities/steering-committee";
      if (activeTab === "organizing") endpoint = "/academic-activities/organizing-committee";
      if (activeTab === "support") endpoint = "/academic-activities/support-committee";

      const memberId = editingMember ? Number(value(editingMember, activeTab === "steering" ? "MaChiDao" : activeTab === "organizing" ? "MaBanTC" : "MaBanHoTro")) : 0;
      await workflowRequest(editingMember ? `${endpoint}/${memberId}` : endpoint, {
        method: editingMember ? "PATCH" : "POST",
        body: {
          maHD: Number(memberForm.maHD),
          maNgDung: memberForm.maNgDung || undefined,
          hoTen: memberForm.hoTen.trim(),
          hocVi: memberForm.hocVi ? memberForm.hocVi.trim() : undefined,
          chucDanh: memberForm.chucDanh ? memberForm.chucDanh.trim() : undefined,
          chucVu: memberForm.chucVu ? memberForm.chucVu.trim() : undefined,
          nhiemVu: activeTab === "organizing" ? memberForm.nhiemVu.trim() : undefined,
        },
      });
      setNotice(`${editingMember ? "Đã cập nhật" : "Đã thêm"} thành viên "${memberForm.hoTen}" thành công.`);
      setIsMemberModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể thêm thành viên.");
    } finally {
      setBusy(false);
    }
  };

  // Delete Member
  const handleDeleteMember = async (m: Row) => {
    const name = text(m, "HoTen");
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thành viên "${name}" khỏi ban?`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (activeTab === "steering") {
        const id = Number(value(m, "MaChiDao"));
        await workflowRequest(`/academic-activities/steering-committee/${id}`, { method: "DELETE" });
      } else if (activeTab === "organizing") {
        const id = Number(value(m, "MaBanTC"));
        await workflowRequest(`/academic-activities/organizing-committee/${id}`, { method: "DELETE" });
      } else if (activeTab === "support") {
        const id = Number(value(m, "MaBanHoTro"));
        await workflowRequest(`/academic-activities/support-committee/${id}`, { method: "DELETE" });
      }
      setNotice(`Đã xóa thành viên "${name}".`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa thành viên.");
    } finally {
      setBusy(false);
    }
  };

  // CSV Export
  const exportCSV = () => {
    if (activeTab === "activities") {
      const headers = ["Mã HĐ", "Tên hoạt động", "Bộ môn", "Loại hoạt động", "Nội dung", "Thời gian dự kiến", "Địa điểm", "SL SV dự kiến", "Trạng thái hoạt động"];
      const rowsData = filteredActivities.map((a) => [
        String(value(a, "MaHD")),
        text(a, "TenHoatDong"),
        text(a, "TenBM"),
        text(a, "LoaiHoatDong"),
        text(a, "NoiDung"),
        formatDate(a["TgDuKien"]),
        text(a, "DiaDiem"),
        String(value(a, "SLSVDuKien")),
        text(a, "TrangThai"),
      ]);
      const csv = "\uFEFF" + [headers.join(","), ...rowsData.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Hoat_dong_hoc_thuat_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } else {
      const headers = ["Mã ban", "Mã HĐ", "Hoạt động", "Họ tên", "Học vị", "Chức danh", "Chức vụ", activeTab === "organizing" ? "Nhiệm vụ" : ""];
      const rowsData = currentCommitteeList.map((m) => [
        String(value(m, activeTab === "steering" ? "MaChiDao" : activeTab === "organizing" ? "MaBanTC" : "MaBanHoTro")),
        String(value(m, "MaHD")),
        text(m, "TenHoatDong"),
        text(m, "HoTen"),
        text(m, "HocVi"),
        text(m, "ChucDanh"),
        text(m, "ChucVu"),
        activeTab === "organizing" ? text(m, "NhiemVu") : "",
      ]);
      const csv = "\uFEFF" + [headers.filter(Boolean).join(","), ...rowsData.map((r) => r.filter((_, i) => i < headers.length).map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Danh_sach_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
  };

  return (
    <div className={s.usersPanelWrapper}>
      {/* Alert notices */}
      {error ? <NoticeDialog message={error} kind="error" onClose={() => setError("")} /> : notice ? <NoticeDialog message={notice} kind="success" title={notice.startsWith("Đã gửi xem xét ký duyệt thành công") ? "Thông báo" : undefined} onClose={() => setNotice("")} /> : null}

      {/* Top Header - KHÔNG CÒN DÒNG CHỮ PHỤ VÀ NÚT TẠO Ở ĐÂY */}
      <div className={s.usersHeaderRow} style={{ marginBottom: "16px" }}>
        <div>
          <h1 className={s.usersPageTitle}>
            {activeTab === "activities"
              ? "Hoạt động học thuật"
              : activeTab === "steering"
              ? "Ban chỉ đạo hoạt động học thuật"
              : activeTab === "organizing"
              ? "Ban tổ chức hoạt động học thuật"
              : "Ban hỗ trợ hoạt động học thuật"}
          </h1>
        </div>
      </div>

      {/* Navigation Sub-Tabs VÀ NÚT TẠO HOẠT ĐỘNG NGANG VỚI CÁC BAN */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Nhóm các tab con */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("activities")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: activeTab === "activities" ? 700 : 500,
              background: activeTab === "activities" ? "#2563eb" : "#f1f5f9",
              color: activeTab === "activities" ? "#ffffff" : "#475569",
              transition: "all 0.15s ease",
            }}
          >
            📋 Danh sách hoạt động ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("steering")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: activeTab === "steering" ? 700 : 500,
              background: activeTab === "steering" ? "#2563eb" : "#f1f5f9",
              color: activeTab === "steering" ? "#ffffff" : "#475569",
              transition: "all 0.15s ease",
            }}
          >
            🏛️ Ban chỉ đạo ({steeringMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("organizing")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: activeTab === "organizing" ? 700 : 500,
              background: activeTab === "organizing" ? "#2563eb" : "#f1f5f9",
              color: activeTab === "organizing" ? "#ffffff" : "#475569",
              transition: "all 0.15s ease",
            }}
          >
            👥 Ban tổ chức ({organizingMembers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("support")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: activeTab === "support" ? 700 : 500,
              background: activeTab === "support" ? "#2563eb" : "#f1f5f9",
              color: activeTab === "support" ? "#ffffff" : "#475569",
              transition: "all 0.15s ease",
            }}
          >
            🤝 Ban hỗ trợ ({supportMembers.length})
          </button>
        </div>

        {/* Nút Tạo hoạt động / Thêm thành viên NẰM NGANG VỚI CÁC BAN */}
        <div>
          {activeTab === "activities" ? (
            <button
              type="button"
              className={s.primary}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "38px",
                padding: "0 18px",
                fontWeight: 600,
                fontSize: "14px",
                whiteSpace: "nowrap",
              }}
              onClick={openCreateModal}
            >
              <span style={{ fontSize: "18px", lineHeight: 1 }}>＋</span>
              Tạo hoạt động học thuật
            </button>
          ) : (
            <button
              type="button"
              className={s.primary}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "38px",
                padding: "0 18px",
                fontWeight: 600,
                fontSize: "14px",
                whiteSpace: "nowrap",
              }}
              onClick={openAddMemberModal}
            >
              <span style={{ fontSize: "18px", lineHeight: 1 }}>＋</span>
              Thêm thành viên {activeTab === "steering" ? "Ban chỉ đạo" : activeTab === "organizing" ? "Ban tổ chức" : "Ban hỗ trợ"}
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Tổng hoạt động</span>
            <div className={`${s.kpiIconWrap} ${s.kpiBlue}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalCount}</div>
          <div className={s.kpiBadgeGreen}>Đã lên kế hoạch</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Cuộc thi học thuật</span>
            <div className={`${s.kpiIconWrap} ${s.kpiPurple}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="7" />
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{competitionCount}</div>
          <div className={s.kpiBadgeBlue}>Trọng điểm khoa</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Seminar / Workshop</span>
            <div className={`${s.kpiIconWrap} ${s.kpiGreen}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{seminarCount}</div>
          <div className={s.kpiBadgeGreen}>Chuyên đề học thuật</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Trạng thái dự thảo</span>
            <div className={`${s.kpiIconWrap} ${s.kpiAmber}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{draftCount}</div>
          <div className={s.kpiBadgeAmber}>Mặc định: Dự thảo</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className={s.usersToolbar}>
        <div className={s.searchField}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder={
              activeTab === "activities"
                ? "Tìm theo mã HĐ (số), tên hoạt động, bộ môn, địa điểm, nội dung..."
                : "Tìm theo họ tên, chức vụ, mã HĐ..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Lọc khi ở tab Hoạt động */}
        {activeTab === "activities" ? (
          <>
            <div className={s.filterDropdown}>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">Tất cả loại hoạt động</option>
                <option value="Cuộc thi">Cuộc thi</option>
                <option value="Seminar">Seminar</option>
                <option value="Workshop">Workshop</option>
                <option value="Tọa đàm">Tọa đàm</option>
              </select>
            </div>


          </>
        ) : (
          /* Lọc theo hoạt động cho các ban */
          <div className={s.filterDropdown} style={{ minWidth: "240px" }}>
            <select value={selectedActivityFilter} onChange={(e) => setSelectedActivityFilter(e.target.value)}>
              <option value="all">Tất cả hoạt động</option>
              {activities.map((a, i) => (
                <option key={`opt-act-${i}`} value={String(value(a, "MaHD"))}>
                  #{value(a, "MaHD")} - {text(a, "TenHoatDong")}
                </option>
              ))}
            </select>
          </div>
        )}

        <button className={s.exportBtn} onClick={() => void loadData()} title="Làm mới">
          🔄 Làm mới
        </button>
        <button className={s.exportBtn} onClick={exportCSV} title="Xuất dữ liệu CSV">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Xuất dữ liệu
        </button>
      </div>

      {/* Main Table: TAB 1 HOẠT ĐỘNG HỌC THUẬT (ĐÃ BỎ CỘT TIẾN ĐỘ THỰC HIỆN, MÃ HĐ LÀ INT) */}
      {activeTab === "activities" && (
        <div className={s.tableCard}>
          <div style={{ overflowX: "auto" }}>
            <table className={`${s.modernTable} ${s.academicActivitiesTable}`}>
              <thead>
                <tr>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "70px", textAlign: "center" }}>Mã HĐ</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "220px" }}>Tên hoạt động</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "130px" }}>Bộ môn</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "100px" }}>Loại</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "210px" }}>Nội dung</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "125px" }}>Thời gian dự kiến</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "155px" }}>Địa điểm</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "180px", textAlign: "center" }}>SL dự kiến</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "250px", textAlign: "center" }}>Trạng thái</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "270px", textAlign: "left" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                      Đang tải danh sách hoạt động học thuật…
                    </td>
                  </tr>
                ) : filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                      Không tìm thấy hoạt động học thuật phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  paginatedActivities.map((act, index) => {
                    const id = Number(value(act, "MaHD"));
                    const tenHoatDong = text(act, "TenHoatDong");
                    const tenBM = text(act, "TenBM");
                    const loai = text(act, "LoaiHoatDong");
                    const noiDung = text(act, "NoiDung");
                    const tgDuKienStr = formatDate(act["TgDuKien"]);
                    const diaDiem = text(act, "DiaDiem");
                    const slsv = value(act, "SLSVDuKien");
                    const rawTrangThai = text(act, "TrangThai");
                    const proposalStatus = text(act, "TrangThaiDeXuatBoMon");
                    const annualPlanStatus = text(act, "TrangThaiKeHoachKhoa");
                    const maKeHoachKhoa = value(act, "MaKeHoachKhoa");
                    const trangThai = rawTrangThai === "Chờ duyệt"
                      ? proposalStatus === "Chờ khoa" ? "Chờ Trưởng ban học thuật tổng hợp"
                        : proposalStatus === "Đã duyệt" && annualPlanStatus === "Chờ Trưởng khoa ký duyệt" ? "Chờ Trưởng khoa duyệt"
                          : proposalStatus === "Đã duyệt" && annualPlanStatus === "Đã duyệt" ? "Đã duyệt"
                            : proposalStatus === "Đã duyệt" && maKeHoachKhoa && ["Dự thảo", "Cần bổ sung"].includes(annualPlanStatus) ? "Đã gộp kế hoạch, chờ trình Trưởng khoa"
                              : proposalStatus === "Đã duyệt" && maKeHoachKhoa ? "Đã gộp kế hoạch"
                              : proposalStatus === "Đã duyệt" ? "Đã tổng hợp, chờ gộp kế hoạch" : "Chờ Trưởng khoa"
                      : rawTrangThai;

                    // Badges for Loai
                    let loaiStyle = { background: "#e0f2fe", color: "#0369a1" };
                    if (loai === "Cuộc thi") loaiStyle = { background: "#f3e8ff", color: "#7e22ce" };
                    else if (loai === "Workshop") loaiStyle = { background: "#ecfdf5", color: "#047857" };
                    else if (loai === "Tọa đàm") loaiStyle = { background: "#fff7ed", color: "#c2410c" };

                    return (
                      <tr key={`act-row-${id}-${index}`}>
                        {/* Mã hoạt động: INT */}
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontWeight: 700, color: "#1e40af", fontFamily: "monospace", fontSize: "14px" }}>
                            {id}
                          </span>
                        </td>

                        {/* Tên hoạt động */}
                        <td>
                          <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>{tenHoatDong}</strong>
                        </td>

                        {/* Bộ môn */}
                        <td>
                          <span style={{ color: "#334155", fontSize: "13px", fontWeight: 500 }}>
                            {tenBM !== "—" ? tenBM : "—"}
                          </span>
                        </td>

                        {/* Loại hoạt động */}
                        <td>
                          <span style={{ color: "#475569", fontSize: "13px" }}>
                            {loai}
                          </span>
                        </td>

                        {/* Nội dung */}
                        <td>
                          <span style={{ color: "#475569", fontSize: "13px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {noiDung}
                          </span>
                        </td>

                        {/* Thời gian dự kiến: Hiển thị DATE */}
                        <td>
                          <span style={{ color: "#475569", fontSize: "13px" }}>
                            {tgDuKienStr}
                          </span>
                        </td>

                        {/* Địa điểm */}
                        <td>
                          <span style={{ color: diaDiem !== "—" ? "#334155" : "#94a3b8", fontSize: "13px" }}>
                            {diaDiem}
                          </span>
                        </td>

                        {/* SL SV dự kiến */}
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>{slsv}</span>
                        </td>

                        {/* Trạng thái hoạt động */}
                        <td className={s.academicActivitiesStatusCell}>
                          <span className={`${s.statusPill} ${s.academicActivitiesStatusPill} ${trangThai === "Đã duyệt" ? s.badgeGreen : s.badgeAmber}`}>
                            {trangThai}
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className={s.activityActionsCell} style={{ textAlign: "left" }}>
                          <div className={s.rowActions}>
                            <button type="button" title="Xem hoạt động" className={s.rowActionBtn} onClick={() => openViewModal(act)}>
                              👁 Xem
                            </button>
                            {!isFacultyLeader && <>
                              <button type="button" title="Mở Kinh phí & quyết toán" className={s.rowActionBtn} onClick={() => onNavigateExpenses ? onNavigateExpenses(id, tenHoatDong) : setBudgetActivity(act)}>💰 Kinh phí</button>
                              <button type="button" title="Sửa hoạt động" className={s.rowActionBtn} onClick={() => openEditModal(act)}>✏️ Sửa</button>
                            </>}
                            {["Dự thảo", "Từ chối"].includes(rawTrangThai) ? <button type="button" title="Gửi hoạt động và kinh phí sang Ban bộ môn" className={s.rowActionBtn} disabled={busy} onClick={() => handleSubmitApproval(act)}>
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                              Gửi
                            </button> : <button type="button" className={s.rowActionBtn} disabled title={trangThai === "Chờ Trưởng bộ môn" ? "Đề xuất đang được Ban bộ môn xem xét" : "Đề xuất đã được chuyển sang bước tiếp theo"}>
                            {trangThai === "Chờ Trưởng bộ môn" ? "Chờ Ban bộ môn" : trangThai === "Chờ Trưởng ban học thuật tổng hợp" ? "Chờ tổng hợp" : trangThai}
                            </button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang: 10 hoạt động 1 trang */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              borderTop: "1px solid #f1f5f9",
              background: "#fafbfc",
              fontSize: "14px",
              color: "#64748b",
            }}
          >
            <span>
              Hiển thị{" "}
              <strong style={{ color: "#1e293b" }}>
                {filteredActivities.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredActivities.length)}
              </strong>{" "}
              trên tổng số <strong style={{ color: "#1e293b" }}>{filteredActivities.length}</strong> hoạt động
            </span>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className={s.exportBtn}
                style={{ padding: "6px 12px", minHeight: "auto" }}
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Trước
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: p === safePage ? 700 : 500,
                    background: p === safePage ? "#2563eb" : "#ffffff",
                    borderColor: p === safePage ? "#2563eb" : "#e2e8f0",
                    color: p === safePage ? "#ffffff" : "#475569",
                  }}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className={s.exportBtn}
                style={{ padding: "6px 12px", minHeight: "auto" }}
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table: TAB 2, 3, 4 CÁC BAN */}
      {activeTab !== "activities" && (
        <div className={s.tableCard}>
          <div style={{ overflowX: "auto" }}>
            <table className={s.modernTable}>
              <thead>
                <tr>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "90px" }}>Mã ban</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "90px", textAlign: "center" }}>Mã HĐ</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "300px", maxWidth: "300px" }}>Hoạt động học thuật</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "190px", maxWidth: "190px" }}>Họ tên</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "120px" }}>Học vị</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "160px" }}>Chức danh</th>
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "160px" }}>Chức vụ trong ban</th>
                  {activeTab === "organizing" && (
                    <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", minWidth: "220px" }}>Nhiệm vụ</th>
                  )}
                  <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", width: "150px", textAlign: "right", whiteSpace: "nowrap" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === "organizing" ? 9 : 8} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                      Đang tải danh sách thành viên…
                    </td>
                  </tr>
                ) : currentCommitteeList.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === "organizing" ? 9 : 8} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                      Chưa có thành viên nào trong danh sách.
                    </td>
                  </tr>
                ) : (
                  paginatedCommittees.map((m, index) => {
                    const id = Number(value(m, activeTab === "steering" ? "MaChiDao" : activeTab === "organizing" ? "MaBanTC" : "MaBanHoTro"));
                    const actId = value(m, "MaHD");
                    const hoTen = text(m, "HoTen");
                    const hocVi = text(m, "HocVi");
                    const chucDanh = text(m, "ChucDanh");
                    const chucVu = text(m, "ChucVu");
                    const tenHD = text(m, "TenHoatDong");
                    const nhiemVu = text(m, "NhiemVu");

                    return (
                      <tr key={`comm-row-${id}-${index}`}>
                        <td>
                          <span style={{ fontFamily: "monospace", color: "#64748b", fontWeight: 600 }}>#{id}</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontFamily: "monospace", color: "#1e40af", fontWeight: 700 }}>#{actId}</span>
                        </td>
                        <td>
                          <div title={tenHD} style={{ fontWeight: 600, color: "#0f172a", maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.45 }}>{tenHD}</div>
                        </td>
                        <td>
                          <strong title={hoTen} style={{ display: "block", color: "#1e293b", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hoTen}</strong>
                        </td>
                        <td>
                          <span style={{ color: hocVi !== "—" ? "#334155" : "#94a3b8" }}>{hocVi}</span>
                        </td>
                        <td>
                          <span style={{ color: "#475569" }}>{chucDanh}</span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: chucVu.includes("Trưởng") ? "#eff6ff" : "#f1f5f9",
                              color: chucVu.includes("Trưởng") ? "#1d4ed8" : "#475569",
                            }}
                          >
                            {chucVu}
                          </span>
                        </td>
                        {activeTab === "organizing" && (
                          <td>
                            <span style={{ color: "#475569", fontSize: "13px" }}>{nhiemVu}</span>
                          </td>
                        )}
                        <td>
                          <div className={s.committeeActions}>
                          <button type="button" className={s.rowActionBtn} title="Chỉnh sửa thành viên" onClick={() => openEditMemberModal(m)}>
                            ✏️ Sửa
                          </button>
                          <button
                            type="button"
                            className={`${s.rowActionBtn} ${s.actionLock}`}
                            title="Xóa thành viên"
                            onClick={() => handleDeleteMember(m)}
                          >
                            🗑️ Xóa
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang: 10 thành viên 1 trang */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              borderTop: "1px solid #f1f5f9",
              background: "#fafbfc",
              fontSize: "14px",
              color: "#64748b",
            }}
          >
            <span>
              Hiển thị{" "}
              <strong style={{ color: "#1e293b" }}>
                {currentCommitteeList.length === 0 ? 0 : (safeCommitteePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safeCommitteePage * PAGE_SIZE, currentCommitteeList.length)}
              </strong>{" "}
              trên tổng số <strong style={{ color: "#1e293b" }}>{currentCommitteeList.length}</strong> thành viên
            </span>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className={s.exportBtn}
                style={{ padding: "6px 12px", minHeight: "auto" }}
                disabled={safeCommitteePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Trước
              </button>

              {Array.from({ length: totalCommitteePages }, (_, i) => i + 1).map((p) => (
                <button
                  key={`comm-page-${p}`}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: p === safeCommitteePage ? 700 : 500,
                    background: p === safeCommitteePage ? "#2563eb" : "#ffffff",
                    borderColor: p === safeCommitteePage ? "#2563eb" : "#e2e8f0",
                    color: p === safeCommitteePage ? "#ffffff" : "#475569",
                  }}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                className={s.exportBtn}
                style={{ padding: "6px 12px", minHeight: "auto" }}
                disabled={safeCommitteePage >= totalCommitteePages}
                onClick={() => setCurrentPage((p) => Math.min(totalCommitteePages, p + 1))}
              >
                Sau →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TẠO / SỬA HOẠT ĐỘNG HỌC THUẬT */}
      {isActivityModalOpen && (
        <div className={s.modalOverlay} role="dialog" aria-modal="true">
          <div className={s.modalCard} style={{ maxWidth: "900px", width: "min(900px, calc(100vw - 32px))" }}>
            <div className={s.modalHeader}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a", fontWeight: 700 }}>
                {viewingActivity && editingActivity ? `Xem hoạt động #${value(editingActivity, "MaHD")}` : editingActivity ? `Chỉnh sửa hoạt động #${value(editingActivity, "MaHD")}` : "Tạo hoạt động học thuật mới"}
              </h3>
              <button type="button" className={s.modalCloseBtn} onClick={() => setIsActivityModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitActivity}>
              <div className={s.modalBody} style={{ maxHeight: "70vh", overflowY: "auto", padding: "20px 24px" }}>
                {/* 2 cột: Bộ môn phụ trách (MaBM) & Tên hoạt động */}
                <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "12px", marginBottom: "16px" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Mã HĐ</label>
                      <input value={editingActivity ? String(value(editingActivity, "MaHD")) : String(nextActivityId)} readOnly aria-readonly="true" style={{ width: "100%", padding: "10px 8px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", fontSize: "14px" }} />
                    </div>
                  <div style={{ gridColumn: "1 / -1", display: "none" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      Bộ môn phụ trách
                    </label>
                    <select
                      value={activityForm.maBM}
                      onChange={(e) => setActivityForm({ ...activityForm, maBM: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        background: "#ffffff",
                      }}
                    >
                      <option value="">Chưa chọn bộ môn...</option>
                      {departments.map((d, i) => (
                        <option key={`f-bm-${i}`} value={Number(value(d, "MaBM"))}>
                          {text(d, "TenBM")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      Tên hoạt động <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập tên hoạt động học thuật..."
                      value={activityForm.tenHoatDong}
                      onChange={(e) => setActivityForm({ ...activityForm, tenHoatDong: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                <div className={s.activityMetaGrid}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Bộ môn phụ trách</label>
                    <select value={activityForm.maBM} onChange={(e) => setActivityForm({ ...activityForm, maBM: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#ffffff" }}>
                      <option value="">Chưa chọn bộ môn...</option>
                      {departments.map((d, i) => <option key={`f-bm-lower-${i}`} value={Number(value(d, "MaBM"))}>{text(d, "TenBM")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Năm học <span style={{ color: "#ef4444" }}>*</span></label>
                    <input required type="text" maxLength={20} placeholder="Ví dụ: 2025-2026" value={activityForm.namHoc} onChange={(e) => setActivityForm({ ...activityForm, namHoc: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Cấp tổ chức</label>
                    <select value={activityForm.capTC} onChange={(e) => setActivityForm({ ...activityForm, capTC: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#ffffff" }}>
                      <option value="">Có thể để trống...</option>
                      <option value="Cấp Khoa/Liên bộ môn">Cấp Khoa/Liên bộ môn</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Loại hoạt động <span style={{ color: "#ef4444" }}>*</span></label>
                    <select required value={activityForm.loaiHoatDong} onChange={(e) => setActivityForm({ ...activityForm, loaiHoatDong: e.target.value as "Cuộc thi" | "Seminar" | "Workshop" | "Tọa đàm" })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#ffffff" }}>
                      <option value="Cuộc thi">Cuộc thi</option><option value="Seminar">Seminar</option><option value="Workshop">Workshop</option><option value="Tọa đàm">Tọa đàm</option>
                    </select>
                  </div>
                </div>

                {/* Thời gian dự kiến được lưu dưới dạng văn bản */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      Thời gian dự kiến <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>
                    </label>
                    <input type="text" required maxLength={225} placeholder="Nhập thời gian dự kiến..." value={activityForm.tgDuKien} onChange={(e) => setActivityForm({ ...activityForm, tgDuKien: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Thời gian bắt đầu</label>
                    <input type="time" value={activityForm.tgBatDau} onChange={(e) => setActivityForm({ ...activityForm, tgBatDau: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Thời gian kết thúc</label>
                    <input type="time" value={activityForm.tgKetThuc} onChange={(e) => setActivityForm({ ...activityForm, tgKetThuc: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
                  </div>
                </div>

                {/* Nội dung (bắt buộc *) */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                    Nội dung hoạt động <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Mô tả nội dung, hình thức và mục tiêu của hoạt động..."
                    value={activityForm.noiDung}
                    onChange={(e) => setActivityForm({ ...activityForm, noiDung: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      lineHeight: "1.4",
                    }}
                  />
                </div>

                {/* Địa điểm + số lượng sinh viên */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                      Địa điểm
                    </label>
                    <input
                      type="text"
                      placeholder="Hội trường A, Phòng máy khu A..."
                      value={activityForm.diaDiem}
                      onChange={(e) => setActivityForm({ ...activityForm, diaDiem: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      SL sinh viên dự kiến <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={225}
                      placeholder="Nhập số lượng dự kiến..."
                      value={activityForm.slsvDuKien}
                      onChange={(e) => setActivityForm({ ...activityForm, slsvDuKien: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                {/* Tiến độ thực hiện */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>Tiến độ thực hiện</label>
                  <textarea
                    rows={3}
                    placeholder="Đang chuẩn bị, Hoàn thành..."
                    value={activityForm.tienDoTH}
                    onChange={(e) => setActivityForm({ ...activityForm, tienDoTH: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      lineHeight: "1.4",
                    }}
                  />
                </div>

                {/* Trạng thái */}
                {editingActivity && (
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      Trạng thái hoạt động
                    </label>
                    <select
                      value={activityForm.trangThai}
                      onChange={(e) => setActivityForm({ ...activityForm, trangThai: e.target.value })}
                      style={{
                        width: "50%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        background: "#ffffff",
                      }}
                    >
                      <option value="Dự thảo">Dự thảo</option>
                      <option value="Đã duyệt">Đã duyệt</option>
                      <option value="Từ chối">Từ chối</option>
                    </select>
                  </div>
                )}
              </div>

              <div className={s.modalFooter} style={{ padding: "16px 24px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className={s.exportBtn}
                  disabled={busy}
                  onClick={() => setIsActivityModalOpen(false)}
                >
                  Hủy
                </button>
                {!viewingActivity && <button
                  type="submit"
                  className={s.primary}
                  disabled={busy}
                  style={{ minWidth: "120px" }}
                >
                  {busy ? "Đang lưu…" : editingActivity ? "Lưu thay đổi" : "Tạo hoạt động"}
                </button>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: THÊM THÀNH VIÊN BAN */}
      {isMemberModalOpen && (
        <div className={s.modalOverlay} role="dialog" aria-modal="true">
          <div className={s.modalCard} style={{ maxWidth: "680px", width: "min(680px, calc(100vw - 32px))" }}>
            <div className={s.modalHeader}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a", fontWeight: 700 }}>
                {editingMember ? "Chỉnh sửa" : "Thêm"} thành viên {activeTab === "steering" ? "Ban chỉ đạo" : activeTab === "organizing" ? "Ban tổ chức" : "Ban hỗ trợ"}
              </h3>
              <button type="button" className={s.modalCloseBtn} onClick={() => setIsMemberModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitMember}>
              <div className={s.modalBody} style={{ padding: "20px 24px" }}>
                {/* Chọn hoạt động */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                    Hoạt động học thuật <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>
                  </label>
                  <select
                    required
                    value={memberForm.maHD}
                    onChange={(e) => setMemberForm({ ...memberForm, maHD: Number(e.target.value) })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      background: "#ffffff",
                    }}
                  >
                    {activities.map((a, i) => (
                      <option key={`opt-mem-act-${i}`} value={Number(value(a, "MaHD"))}>
                        #{value(a, "MaHD")} - {text(a, "TenHoatDong")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Họ tên */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                    Họ và tên thành viên <span style={{ color: "#ef4444", fontWeight: "bold" }}>*</span>
                  </label>
                  <select
                    value={memberForm.maNgDung || ""}
                    onChange={(e) => {
                      const staff = staffRecords.find((item) => String(value(item, "MaNgDung")) === e.target.value);
                      if (staff) handleStaffNameChange(text(staff, "HoTen"));
                    }}
                    style={{ width: "100%", marginBottom: "8px", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", background: "#f8fafc", color: "#334155" }}
                  >
                    <option value="">-- Chọn cán bộ để tự điền thông tin --</option>
                    {staffRecords.map((staff, index) => (
                      <option key={`staff-choice-${index}`} value={String(value(staff, "MaNgDung"))}>
                        {text(staff, "HoTen")} — {text(staff, "ChucVu")} / {text(staff, "HocVi")}
                      </option>
                    ))}
                  </select>
                  <input
                    list="committee-staff-list"
                    type="text"
                    required
                    placeholder="Nhập họ và tên..."
                    value={memberForm.hoTen}
                    onChange={(e) => handleStaffNameChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                    }}
                  />
                  <datalist id="committee-staff-list">
                    {staffRecords.map((staff, index) => (
                      <option key={`committee-staff-${index}`} value={text(staff, "HoTen")}>
                        {text(staff, "ChucVu")} - {text(staff, "HocVi")}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* 2 cột: Học vị & Chức danh */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                      Học vị
                    </label>
                    <select
                      value={memberForm.hocVi}
                      onChange={(e) => setMemberForm({ ...memberForm, hocVi: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        background: "#ffffff",
                      }}
                    >
                      <option value="">(Không chọn / Khác)</option>
                      <option value="Thạc sĩ">Thạc sĩ</option>
                      <option value="Tiến sĩ">Tiến sĩ</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                      Chức danh
                    </label>
                    <input
                      type="text"
                      placeholder="Giảng viên, Giảng viên chính, Sinh viên..."
                      value={memberForm.chucDanh}
                      onChange={(e) => setMemberForm({ ...memberForm, chucDanh: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                {/* Chức vụ trong ban */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                    Chức vụ trong ban
                  </label>
                  <input
                    type="text"
                    placeholder="Trưởng ban, Phó ban, Ủy viên, Thành viên hỗ trợ..."
                    value={memberForm.chucVu}
                    onChange={(e) => setMemberForm({ ...memberForm, chucVu: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* Nhiệm vụ (dành riêng cho Ban tổ chức) */}
                {activeTab === "organizing" && (
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      Nhiệm vụ phân công
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Phụ trách xây dựng đề thi, phụ trách kỹ thuật, hậu cần..."
                      value={memberForm.nhiemVu}
                      onChange={(e) => setMemberForm({ ...memberForm, nhiemVu: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                )}
              </div>

              <div className={s.modalFooter} style={{ padding: "16px 24px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  className={s.exportBtn}
                  disabled={busy}
                  onClick={() => setIsMemberModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={s.primary}
                  disabled={busy}
                  style={{ minWidth: "120px" }}
                >
                  {busy ? "Đang lưu…" : "Thêm thành viên"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {budgetActivity && (
        <div className={s.modalOverlay} role="dialog" aria-modal="true">
          <div className={s.modalCard} style={{ maxWidth: "680px", width: "min(680px, calc(100vw - 32px))" }}>
            <div className={s.modalHeader}><h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>Tạo kinh phí hoạt động</h3><button type="button" className={s.modalCloseBtn} onClick={() => setBudgetActivity(null)}>✕</button></div>
            <form onSubmit={async (e) => { e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); try { await workflowRequest(`/academic-activities/${Number(value(budgetActivity, "MaHD"))}/budget`, { method: "POST", body: { noiDung: String(form.get("noiDung")), soLuong: form.get("soLuong") ? Number(form.get("soLuong")) : undefined, donViTinh: form.get("donViTinh"), donGia: form.get("donGia") ? Number(form.get("donGia")) : undefined, soTien: Number(form.get("soTien")), thuyetMinh: form.get("thuyetMinh"), nguonKinhPhi: form.get("nguonKinhPhi"), ghiChu: form.get("ghiChu") } }); setNotice("Đã tạo dòng kinh phí cho hoạt động."); setBudgetActivity(null); } catch (err) { setError(err instanceof Error ? err.message : "Không thể tạo kinh phí."); } finally { setBusy(false); } }}>
              <div className={s.modalBody} style={{ padding: "20px 24px" }}>
                <p style={{ marginTop: 0, color: "#475569" }}>Hoạt động: <strong>{text(budgetActivity, "TenHoatDong")}</strong></p>
                <label className={s.businessField}><span>Nội dung kinh phí *</span><input name="noiDung" required placeholder="Ví dụ: In tài liệu, thuê hội trường..." /></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}><label className={s.businessField}><span>Số lượng</span><input name="soLuong" type="number" min="0" step="0.01" /></label><label className={s.businessField}><span>Đơn vị tính</span><input name="donViTinh" placeholder="bộ, người..." /></label><label className={s.businessField}><span>Đơn giá</span><input name="donGia" type="number" min="0" step="0.01" /></label></div>
                <label className={s.businessField}><span>Số tiền dự trù *</span><input name="soTien" type="number" min="0" step="0.01" required /></label><label className={s.businessField}><span>Thuyết minh</span><textarea name="thuyetMinh" rows={2} /></label><label className={s.businessField}><span>Nguồn kinh phí</span><input name="nguonKinhPhi" defaultValue="Kinh phí học thuật" /></label><label className={s.businessField}><span>Ghi chú</span><input name="ghiChu" /></label>
              </div><div className={s.modalFooter}><button type="button" className={s.exportBtn} onClick={() => setBudgetActivity(null)}>Hủy</button><button type="submit" className={s.primary} disabled={busy}>{busy ? "Đang lưu…" : "Lưu kinh phí"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

