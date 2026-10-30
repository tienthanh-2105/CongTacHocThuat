"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { workflowRequest } from "@/services/workflow";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;

const value = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const actual = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    const res = actual ? row[actual] : undefined;
    if (res !== undefined && res !== null && res !== "") return res;
  }
  return undefined;
};

const text = (row: Row, ...keys: string[]) => {
  const res = value(row, ...keys);
  return res === undefined ? "—" : String(res);
};

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: "19px", height: "19px" }}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export default function StaffProfilesPanel() {
  const [staffList, setStaffList] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Create modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHoTen, setNewHoTen] = useState("");
  const [newHocVi, setNewHocVi] = useState("Thạc sĩ");
  const [newChucVu, setNewChucVu] = useState("Giảng viên");
  const [newMaBMList, setNewMaBMList] = useState<number[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newSdt, setNewSdt] = useState("");
  const [newCreateAccount, setNewCreateAccount] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("HocThuat@2026");
  const [newRoleId, setNewRoleId] = useState<number | "">("");

  // Edit modal state
  const [editingStaff, setEditingStaff] = useState<Row | null>(null);
  const [editHoTen, setEditHoTen] = useState("");
  const [editHocVi, setEditHocVi] = useState("");
  const [editChucVu, setEditChucVu] = useState("");
  const [editMaBMList, setEditMaBMList] = useState<number[]>([]);
  const [editEmail, setEditEmail] = useState("");
  const [editSdt, setEditSdt] = useState("");
  const [editTrangThai, setEditTrangThai] = useState("Hoạt động");

  // Grant account modal state (cho cán bộ chưa có tài khoản)
  const [grantingStaff, setGrantingStaff] = useState<Row | null>(null);
  const [grantUsername, setGrantUsername] = useState("");
  const [grantPassword, setGrantPassword] = useState("HocThuat@2026");
  const [grantConfirmPassword, setGrantConfirmPassword] = useState("HocThuat@2026");
  const [showGrantPassword, setShowGrantPassword] = useState(false);
  const [showGrantConfirmPassword, setShowGrantConfirmPassword] = useState(false);
  const [grantRoleId, setGrantRoleId] = useState<number | "">("");

  // Delete modal state
  const [deletingStaff, setDeletingStaff] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [staffRows, deptRows, roleRows] = await Promise.all([
        workflowRequest<unknown>("/admin/accounts/staff-records"),
        workflowRequest<unknown>("/admin/accounts/departments").catch(() => []),
        workflowRequest<unknown>("/admin/accounts/roles").catch(() => []),
      ]);
      setStaffList(Array.isArray(staffRows) ? (staffRows as Row[]) : []);
      setDepartments(Array.isArray(deptRows) ? (deptRows as Row[]) : []);
      setRoles(Array.isArray(roleRows) ? (roleRows as Row[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách hồ sơ cán bộ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [staffRows, deptRows, roleRows] = await Promise.all([
          workflowRequest<unknown>("/admin/accounts/staff-records"),
          workflowRequest<unknown>("/admin/accounts/departments").catch(() => []),
          workflowRequest<unknown>("/admin/accounts/roles").catch(() => []),
        ]);
        if (active) {
          setStaffList(Array.isArray(staffRows) ? (staffRows as Row[]) : []);
          setDepartments(Array.isArray(deptRows) ? (deptRows as Row[]) : []);
          setRoles(Array.isArray(roleRows) ? (roleRows as Row[]) : []);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách hồ sơ cán bộ.");
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Metrics
  const totalStaff = staffList.length;
  const phdCount = staffList.filter((st) => text(st, "HocVi").toLowerCase().includes("tiến sĩ")).length;
  const masterCount = staffList.filter((st) => text(st, "HocVi").toLowerCase().includes("thạc sĩ")).length;
  const linkedCount = staffList.filter((st) => text(st, "TenDangNhap") !== "—").length;

  // Sorted departments for clean 2-column display
  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) =>
      text(a, "TenBM").localeCompare(text(b, "TenBM"), "vi")
    );
  }, [departments]);

  // Filtered rows
  const filteredStaff = useMemo(() => {
    return staffList.filter((st) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        text(st, "HoTen").toLowerCase().includes(q) ||
        text(st, "MaDinhDanh").toLowerCase().includes(q) ||
        text(st, "Email").toLowerCase().includes(q) ||
        text(st, "SDT").toLowerCase().includes(q) ||
        text(st, "DanhSachTenBM").toLowerCase().includes(q) ||
        text(st, "TenBM").toLowerCase().includes(q) ||
        text(st, "DonViCongTac").toLowerCase().includes(q) ||
        text(st, "ChucVu").toLowerCase().includes(q) ||
        text(st, "HocVi").toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (deptFilter !== "all") {
        const fullDepts = (text(st, "DanhSachTenBM") + " " + text(st, "TenBM") + " " + text(st, "DonViCongTac")).toLowerCase();
        return fullDepts.includes(deptFilter.toLowerCase());
      }
      return true;
    });
  }, [staffList, search, deptFilter]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, deptFilter]);

  // Pagination calculations (10 giảng viên 1 trang)
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedStaff = useMemo(() => {
    return filteredStaff.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredStaff, startIndex]);

  // Open Create Modal
  function openCreateModal() {
    setNewHoTen("");
    setNewHocVi("Thạc sĩ");
    setNewChucVu("Giảng viên");
    setNewMaBMList(sortedDepartments.length > 0 ? [Number(value(sortedDepartments[0], "MaBM"))] : []);
    setNewEmail("");
    setNewSdt("");
    setNewCreateAccount(false);
    setNewUsername("");
    setNewPassword("HocThuat@2026");
    // Find role GIANGVIEN or default to first non-student role
    const gvRole = roles.find((r) => String(value(r, "TenVaiTro")).toUpperCase().includes("GIẢNG") || String(value(r, "TenVaiTro")).toUpperCase().includes("GIANG"));
    setNewRoleId(gvRole ? Number(value(gvRole, "MaVaiTro")) : (roles[0] ? Number(value(roles[0], "MaVaiTro")) : 3));
    setShowAddModal(true);
  }

  // Handle Create Staff
  async function handleCreateStaff() {
    if (!newHoTen.trim()) {
      setError("Vui lòng nhập họ và tên cán bộ / giảng viên.");
      return;
    }
    if (!newHocVi.trim()) {
      setError("Vui lòng chọn hoặc nhập học hàm / học vị.");
      return;
    }
    if (!newChucVu.trim()) {
      setError("Vui lòng chọn hoặc nhập chức vụ.");
      return;
    }
    if (newMaBMList.length === 0) {
      setError("Vui lòng chọn ít nhất một bộ môn phụ trách.");
      return;
    }
    if (newCreateAccount) {
      if (!newUsername.trim()) {
        setError("Vui lòng nhập tên đăng nhập.");
        return;
      }
      if (!newPassword || newPassword.length < 6) {
        setError("Mật khẩu khởi tạo cần ít nhất 6 ký tự.");
        return;
      }
    }

    setBusy(true);
    setError("");
    try {
      await workflowRequest("/admin/accounts/staff-records", {
        method: "POST",
        body: {
          hoTen: newHoTen.trim(),
          hocVi: newHocVi.trim(),
          chucVu: newChucVu.trim(),
          maBMList: newMaBMList,
          maBM: newMaBMList[0],
          email: newEmail.trim() || null,
          sdt: newSdt.trim() || null,
          createAccount: newCreateAccount,
          username: newCreateAccount ? newUsername.trim() : undefined,
          password: newCreateAccount ? newPassword : undefined,
          roleId: newCreateAccount && newRoleId ? Number(newRoleId) : undefined,
        },
      });
      setNotice(`Đã thêm thành công hồ sơ ${newHoTen.trim()}${newCreateAccount ? ` kèm tài khoản "${newUsername.trim()}"` : ""}.`);
      setShowAddModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thêm hồ sơ cán bộ thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Open Edit Modal
  function openEditModal(st: Row) {
    setEditingStaff(st);
    setEditHoTen(text(st, "HoTen") !== "—" ? text(st, "HoTen") : "");
    setEditHocVi(text(st, "HocVi") !== "—" ? text(st, "HocVi") : "");
    setEditChucVu(text(st, "ChucVu") !== "—" ? text(st, "ChucVu") : "");
    const rawMaBMList = value(st, "DanhSachMaBM");
    if (rawMaBMList) {
      const ids = String(rawMaBMList)
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id) && id > 0);
      setEditMaBMList(ids.length > 0 ? ids : (value(st, "MaBM") ? [Number(value(st, "MaBM"))] : []));
    } else if (value(st, "MaBM")) {
      setEditMaBMList([Number(value(st, "MaBM"))]);
    } else {
      setEditMaBMList([]);
    }
    setEditEmail(text(st, "Email") !== "—" ? text(st, "Email") : "");
    setEditSdt(text(st, "SDT") !== "—" ? text(st, "SDT") : "");
    setEditTrangThai(text(st, "TrangThai") !== "—" ? text(st, "TrangThai") : "Hoạt động");
  }

  // Handle Update Staff
  async function handleUpdateStaff() {
    if (!editingStaff) return;
    const maNgDung = Number(value(editingStaff, "MaNgDung"));
    if (!maNgDung) return;

    if (!editHoTen.trim()) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }
    if (!editHocVi.trim()) {
      setError("Vui lòng nhập hoặc chọn học hàm / học vị.");
      return;
    }
    if (!editChucVu.trim()) {
      setError("Vui lòng nhập hoặc chọn chức vụ.");
      return;
    }
    if (editMaBMList.length === 0) {
      setError("Vui lòng chọn ít nhất một bộ môn phụ trách.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/admin/accounts/staff-records/${maNgDung}`, {
        method: "PATCH",
        body: {
          hoTen: editHoTen.trim(),
          hocVi: editHocVi.trim(),
          chucVu: editChucVu.trim(),
          maBMList: editMaBMList,
          maBM: editMaBMList[0],
          email: editEmail.trim() || null,
          sdt: editSdt.trim() || null,
          trangThai: editTrangThai || "Hoạt động",
        },
      });
      setNotice(`Đã cập nhật thông tin cán bộ/giảng viên ${editHoTen.trim()} thành công.`);
      setEditingStaff(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Open Grant Account Modal
  function openGrantModal(st: Row) {
    setGrantingStaff(st);
    const email = text(st, "Email");
    const defaultUsername = email !== "—" && email.includes("@") ? email.split("@")[0] : `gv.${text(st, "HoTen").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    setGrantUsername(defaultUsername);
    setGrantPassword("HocThuat@2026");
    setGrantConfirmPassword("HocThuat@2026");
    setShowGrantPassword(false);
    setShowGrantConfirmPassword(false);
    const gvRole = roles.find((r) => String(value(r, "TenVaiTro")).toUpperCase().includes("GIẢNG") || String(value(r, "TenVaiTro")).toUpperCase().includes("GIANG"));
    setGrantRoleId(gvRole ? Number(value(gvRole, "MaVaiTro")) : 3);
  }

  // Handle Grant Account
  async function handleGrantAccount() {
    if (!grantingStaff) return;
    const maNgDung = Number(value(grantingStaff, "MaNgDung"));
    if (!maNgDung) return;

    if (!grantUsername.trim()) {
      setError("Vui lòng nhập tên đăng nhập.");
      return;
    }
    if (!grantPassword || grantPassword.length < 6) {
      setError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    if (grantPassword !== grantConfirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!grantRoleId) {
      setError("Vui lòng chọn vai trò cho tài khoản.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/admin/accounts/staff-records/${maNgDung}/account`, {
        method: "POST",
        body: {
          username: grantUsername.trim(),
          password: grantPassword,
          roleId: Number(grantRoleId),
        },
      });
      setNotice(`Đã cấp thành công tài khoản "${grantUsername.trim()}" (Mật khẩu: "${grantPassword}") cho ${text(grantingStaff, "HoTen")}.`);
      setGrantingStaff(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cấp tài khoản thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Handle Delete Staff
  async function handleDeleteStaff() {
    if (!deletingStaff) return;
    const maNgDung = Number(value(deletingStaff, "MaNgDung"));
    if (!maNgDung) return;

    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/admin/accounts/staff-records/${maNgDung}`, {
        method: "DELETE",
      });
      setNotice(`Đã xóa hồ sơ của ${text(deletingStaff, "HoTen")} thành công.`);
      setDeletingStaff(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa hồ sơ thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Export CSV
  const exportCSV = () => {
    const headers = ["Mã cán bộ", "Họ tên giảng viên", "Học hàm học vị", "Chức vụ", "Bộ môn", "Email", "SĐT", "Tài khoản", "Trạng thái"];
    const rowsData = filteredStaff.map((st) => [
      text(st, "MaDinhDanh"),
      text(st, "HoTen"),
      text(st, "HocVi"),
      text(st, "ChucVu") !== "—" ? text(st, "ChucVu") : (text(st, "MaGV") !== "—" ? "Giảng viên" : "—"),
      text(st, "DanhSachTenBM") !== "—" ? text(st, "DanhSachTenBM") : (text(st, "TenBM") !== "—" ? text(st, "TenBM") : text(st, "DonViCongTac")),
      text(st, "Email"),
      text(st, "SDT"),
      text(st, "TenDangNhap"),
      text(st, "TrangThai"),
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rowsData.map((e) => e.map((cell) => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ho_so_can_bo_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={s.usersPanelWrapper}>
      {error && (
        <div className={s.errorAlert} role="alert">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}
      {notice && (
        <div className={s.successAlert} role="status">
          <span>✓ {notice}</span>
          <button onClick={() => setNotice("")}>✕</button>
        </div>
      )}

      {/* Header Row */}
      <div className={s.usersHeaderRow}>
        <div>
          <h1 className={s.usersPageTitle}>Hồ sơ cán bộ &amp; giảng viên</h1>
        </div>
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            height: "42px",
            padding: "0 20px",
            borderRadius: "10px",
            background: "#2563eb",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "14px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
            transition: "all 0.15s ease",
          }}
          onClick={openCreateModal}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Thêm cán bộ / giảng viên
        </button>
      </div>

      {/* KPI Cards */}
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Tổng số cán bộ</span>
            <div className={`${s.kpiIconWrap} ${s.kpiPurple}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalStaff}</div>
          <div className={s.kpiBadgePurple}>Khoa CNTT &amp; các khoa</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Tiến sĩ</span>
            <div className={`${s.kpiIconWrap} ${s.kpiBlue}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{phdCount}</div>
          <div className={s.kpiBadgeBlue}>Giảng viên chính / Trưởng BM</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Thạc sĩ</span>
            <div className={`${s.kpiIconWrap} ${s.kpiGreen}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{masterCount}</div>
          <div className={s.kpiBadgeGreen}>Giảng viên &amp; Cán bộ</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Đã có tài khoản</span>
            <div className={`${s.kpiIconWrap} ${s.kpiAmber}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{linkedCount}</div>
          <div className={s.kpiBadgeAmber}>{(totalStaff > 0 ? Math.round((linkedCount / totalStaff) * 100) : 0)}% đã sẵn sàng</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={s.usersToolbar}>
        <div className={s.searchField}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Tìm theo họ tên, chức vụ, bộ môn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={s.filterDropdown}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">Tất cả bộ môn</option>
            {departments.map((d, i) => (
              <option key={`dept-${i}`} value={text(d, "TenBM")}>
                {text(d, "TenBM")}
              </option>
            ))}
          </select>
        </div>

        <button className={s.exportBtn} onClick={() => void loadData()} title="Làm mới">🔄 Làm mới</button>
        <button className={s.exportBtn} onClick={exportCSV}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Xuất danh sách
        </button>
      </div>

      {/* Table: Họ tên giảng viên, học hàm học vị, chức vụ, Bộ môn, Email & Số điện thoại, trạng thái, thao tác */}
      <div className={s.tableCard}>
        <table className={s.modernTable}>
          <thead>
            <tr>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Họ tên giảng viên</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Học hàm học vị</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Chức vụ</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Bộ môn</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Email &amp; Số điện thoại</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Trạng thái</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  Đang tải danh sách hồ sơ cán bộ…
                </td>
              </tr>
            ) : filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  Không tìm thấy hồ sơ cán bộ phù hợp.
                </td>
              </tr>
            ) : (
              paginatedStaff.map((st, index) => {
                const id = Number(value(st, "MaNgDung"));
                const hoTen = text(st, "HoTen");
                const hocVi = text(st, "HocVi");
                const chucVuRaw = text(st, "ChucVu");
                const chucVu = chucVuRaw !== "—" ? chucVuRaw : (text(st, "MaGV") !== "—" ? "Giảng viên" : "—");
                const tenBM = text(st, "TenBM");
                const donVi = text(st, "DonViCongTac");
                const dsTenBM = text(st, "DanhSachTenBM");
                const boMonStr = dsTenBM !== "—" ? dsTenBM : (tenBM !== "—" ? tenBM : donVi);
                const email = text(st, "Email");
                const sdt = text(st, "SDT");
                const trangThai = text(st, "TrangThai");
                const hasAccount = text(st, "TenDangNhap") !== "—";

                return (
                  <tr key={`staff-row-${id}-${index}`}>
                    {/* Họ tên giảng viên */}
                    <td>
                      <span style={{ fontWeight: 400, color: "#1e293b", fontSize: "14px" }}>{hoTen}</span>
                    </td>

                    {/* Học hàm học vị */}
                    <td>
                      <span style={{ fontWeight: 400, color: "#334155" }}>{hocVi}</span>
                    </td>

                    {/* Chức vụ */}
                    <td>
                      <span style={{ fontWeight: 400, color: "#334155" }}>{chucVu}</span>
                    </td>

                    {/* Bộ môn */}
                    <td>
                      {boMonStr !== "—" ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {boMonStr.split(",").map((bmName, bIdx) => {
                            const trimmed = bmName.trim();
                            if (!trimmed) return null;
                            return (
                              <span
                                key={`bm-tag-${id}-${bIdx}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "3px 9px",
                                  borderRadius: "6px",
                                  background: "#f1f5f9",
                                  color: "#334155",
                                  fontSize: "12.5px",
                                  fontWeight: 500,
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                {trimmed}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>

                    {/* Email & Số điện thoại */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span className={s.emailCell}>{email}</span>
                        {sdt !== "—" && <span style={{ fontSize: "12px", color: "#64748b" }}>{sdt}</span>}
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td>
                      <span className={`${s.statusPill} ${trangThai === "Hoạt động" ? s.badgeGreen : s.badgeRed}`}>
                        {trangThai}
                      </span>
                    </td>

                    {/* Thao tác cho sửa hoặc xóa */}
                    <td style={{ textAlign: "right" }}>
                      <div className={s.rowActions}>
                        <button
                          type="button"
                          title="Chỉnh sửa hồ sơ"
                          className={s.rowActionBtn}
                          onClick={() => openEditModal(st)}
                        >
                          ✏️ Sửa
                        </button>
                        {!hasAccount && (
                          <button
                            type="button"
                            title="Cấp tài khoản đăng nhập"
                            className={s.rowActionBtn}
                            style={{ color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}
                            onClick={() => openGrantModal(st)}
                          >
                            🔑 Cấp TK
                          </button>
                        )}
                        <button
                          type="button"
                          title="Xóa hồ sơ"
                          className={`${s.rowActionBtn} ${s.actionLock}`}
                          onClick={() => setDeletingStaff(st)}
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

        {/* Phân trang: 10 giảng viên 1 trang */}
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
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            {filteredStaff.length > 0 ? (
              <span>
                Hiển thị{" "}
                <strong style={{ color: "#1e293b" }}>{startIndex + 1}</strong> –{" "}
                <strong style={{ color: "#1e293b" }}>
                  {Math.min(startIndex + PAGE_SIZE, filteredStaff.length)}
                </strong>{" "}
                trên tổng số{" "}
                <strong style={{ color: "#1e293b" }}>{filteredStaff.length}</strong> giảng viên &amp; cán bộ
              </span>
            ) : (
              <span>0 kết quả</span>
            )}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: safeCurrentPage <= 1 ? "#f1f5f9" : "#ffffff",
                  color: safeCurrentPage <= 1 ? "#94a3b8" : "#334155",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  cursor: safeCurrentPage <= 1 ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                ‹ Trước
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isActive = pageNum === safeCurrentPage;
                if (
                  totalPages > 7 &&
                  pageNum !== 1 &&
                  pageNum !== totalPages &&
                  Math.abs(pageNum - safeCurrentPage) > 2
                ) {
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return (
                      <span key={`ellipsis-${pageNum}`} style={{ padding: "0 4px", color: "#94a3b8" }}>
                        …
                      </span>
                    );
                  }
                  return null;
                }

                return (
                  <button
                    key={`page-${pageNum}`}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      minWidth: "36px",
                      height: "36px",
                      padding: "0 10px",
                      borderRadius: "8px",
                      border: isActive ? "none" : "1px solid #cbd5e1",
                      background: isActive ? "#2563eb" : "#ffffff",
                      color: isActive ? "#ffffff" : "#334155",
                      fontSize: "13.5px",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      boxShadow: isActive ? "0 2px 6px rgba(37, 99, 235, 0.3)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: "36px",
                  padding: "0 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: safeCurrentPage >= totalPages ? "#f1f5f9" : "#ffffff",
                  color: safeCurrentPage >= totalPages ? "#94a3b8" : "#334155",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  cursor: safeCurrentPage >= totalPages ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Sau ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Thêm mới hồ sơ cán bộ & giảng viên */}
      {showAddModal && (
        <div className={s.modalOverlay}>
          <div
            className={s.modalBox}
            style={{
              maxWidth: "760px",
              width: "92%",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.2)",
            }}
          >
            <div
              className={s.modalHeader}
              style={{
                padding: "22px 30px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
                Thêm mới hồ sơ cán bộ &amp; giảng viên
              </h3>
              <button
                className={s.modalClose}
                onClick={() => setShowAddModal(false)}
                style={{ fontSize: "20px", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>
            <div className={s.modalForm} style={{ padding: "26px 30px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px 26px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>
                    Họ và tên <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    value={newHoTen}
                    onChange={(e) => setNewHoTen(e.target.value)}
                    required
                    placeholder="ví dụ: Nguyễn Văn A"
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>
                    Học hàm / Học vị <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    list="new-hocvi-options"
                    value={newHocVi}
                    onChange={(e) => setNewHocVi(e.target.value)}
                    required
                    placeholder="Tiến sĩ, Thạc sĩ, GS, PGS..."
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                  <datalist id="new-hocvi-options">
                    <option value="Tiến sĩ" />
                    <option value="Thạc sĩ" />
                    <option value="Cử nhân" />
                    <option value="Kỹ sư" />
                    <option value="Giáo sư, Tiến sĩ" />
                    <option value="Phó Giáo sư, Tiến sĩ" />
                  </datalist>
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>
                    Chức vụ <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    list="new-chucvu-options"
                    value={newChucVu}
                    onChange={(e) => setNewChucVu(e.target.value)}
                    required
                    placeholder="Giảng viên, Trưởng bộ môn, Phó Trưởng khoa..."
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                  <datalist id="new-chucvu-options">
                    <option value="Giảng viên" />
                    <option value="Trưởng bộ môn" />
                    <option value="Phó Trưởng bộ môn" />
                    <option value="Trưởng khoa" />
                    <option value="Phó Trưởng khoa" />
                    <option value="Phó Trưởng khoa phụ trách học thuật" />
                    <option value="Trợ lý khoa học" />
                    <option value="Cán bộ khoa" />
                    <option value="Quản trị viên" />
                  </datalist>
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>Email liên hệ</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (!newUsername && e.target.value.includes("@")) {
                        setNewUsername(e.target.value.split("@")[0]);
                      }
                    }}
                    placeholder="email@truong.edu.vn"
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>Số điện thoại</span>
                  <input
                    type="tel"
                    value={newSdt}
                    onChange={(e) => setNewSdt(e.target.value)}
                    placeholder="0901xxxxxx"
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </label>

                {/* Bộ môn trực thuộc & phụ trách: 2 cột song song */}
                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                      Bộ môn trực thuộc &amp; phụ trách <span style={{ color: "#ef4444" }}>*</span>
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#64748b" }}>
                      (Có thể tích chọn 1 hoặc nhiều bộ môn cùng lúc)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      columnGap: "32px",
                      rowGap: "10px",
                      padding: "16px 20px",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                    }}
                  >
                    {sortedDepartments.map((d, i) => {
                      const id = Number(value(d, "MaBM"));
                      const isSelected = newMaBMList.includes(id);
                      return (
                        <label
                          key={`new-dept-${id}-${i}`}
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: "10px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            userSelect: "none",
                            margin: 0,
                            transition: "background 0.15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewMaBMList([...newMaBMList, id]);
                              } else {
                                setNewMaBMList(newMaBMList.filter((m) => m !== id));
                              }
                            }}
                            style={{
                              width: "18px",
                              height: "18px",
                              minWidth: "18px",
                              minHeight: "18px",
                              maxWidth: "18px",
                              maxHeight: "18px",
                              margin: 0,
                              padding: 0,
                              cursor: "pointer",
                              accentColor: "#00bba7",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: "14px",
                              color: isSelected ? "#0f172a" : "#334155",
                              fontWeight: isSelected ? 600 : 400,
                              lineHeight: 1.4,
                            }}
                          >
                            {text(d, "TenBM")}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Box cấp tài khoản đi kèm */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px 20px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  background: newCreateAccount ? "#f0fdf4" : "#f8fafc",
                  transition: "all 0.2s ease",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "14.5px",
                    fontWeight: 600,
                    color: newCreateAccount ? "#166534" : "#1e293b",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newCreateAccount}
                    onChange={(e) => setNewCreateAccount(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span>🔑 Cấp ngay tài khoản đăng nhập cho cán bộ này</span>
                </label>

                {newCreateAccount && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "14px",
                      marginTop: "14px",
                      paddingTop: "14px",
                      borderTop: "1px dashed #bbf7d0",
                    }}
                  >
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                      <span>Tên đăng nhập <span style={{ color: "#ef4444" }}>*</span></span>
                      <input
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        required={newCreateAccount}
                        placeholder="ví dụ: gv.tuan"
                        style={{ height: "40px", padding: "0 12px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff" }}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                      <span>Mật khẩu khởi tạo <span style={{ color: "#ef4444" }}>*</span></span>
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required={newCreateAccount}
                        style={{ height: "40px", padding: "0 12px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff" }}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                      <span>Vai trò hệ thống <span style={{ color: "#ef4444" }}>*</span></span>
                      <select
                        value={newRoleId}
                        onChange={(e) => setNewRoleId(Number(e.target.value))}
                        required={newCreateAccount}
                        style={{ height: "40px", padding: "0 12px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff" }}
                      >
                        {roles.map((r, i) => {
                          const id = Number(value(r, "MaVaiTro"));
                          return (
                            <option key={`role-opt-${id}-${i}`} value={id}>
                              {text(r, "TenVaiTro")}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "16px",
                  paddingTop: "20px",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <button
                  type="button"
                  style={{
                    height: "44px",
                    padding: "0 22px",
                    fontSize: "14.5px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={busy}
                  style={{
                    height: "44px",
                    padding: "0 28px",
                    fontSize: "14.5px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                    opacity: busy ? 0.7 : 1,
                  }}
                  onClick={handleCreateStaff}
                >
                  {busy ? "Đang lưu…" : "Thêm cán bộ / giảng viên"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa hồ sơ cán bộ / giảng viên */}
      {editingStaff && (
        <div className={s.modalOverlay}>
          <div
            className={s.modalBox}
            style={{
              maxWidth: "760px",
              width: "92%",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.2)",
            }}
          >
            <div
              className={s.modalHeader}
              style={{
                padding: "22px 30px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
                Chỉnh sửa hồ sơ cán bộ &amp; giảng viên
              </h3>
              <button
                className={s.modalClose}
                onClick={() => setEditingStaff(null)}
                style={{ fontSize: "20px", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>
            <div className={s.modalForm} style={{ padding: "26px 30px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px 26px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>
                    Họ và tên <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    value={editHoTen}
                    onChange={(e) => setEditHoTen(e.target.value)}
                    required
                    placeholder="Nhập họ và tên đầy đủ"
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>
                    Học hàm / Học vị <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    list="hocvi-options"
                    value={editHocVi}
                    onChange={(e) => setEditHocVi(e.target.value)}
                    required
                    placeholder="Tiến sĩ, Thạc sĩ, GS, PGS..."
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                  <datalist id="hocvi-options">
                    <option value="Tiến sĩ" />
                    <option value="Thạc sĩ" />
                    <option value="Cử nhân" />
                    <option value="Kỹ sư" />
                    <option value="Giáo sư, Tiến sĩ" />
                    <option value="Phó Giáo sư, Tiến sĩ" />
                  </datalist>
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>
                    Chức vụ <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    list="chucvu-options"
                    value={editChucVu}
                    onChange={(e) => setEditChucVu(e.target.value)}
                    required
                    placeholder="Giảng viên, Trưởng bộ môn, Phó Trưởng khoa..."
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                  <datalist id="chucvu-options">
                    <option value="Giảng viên" />
                    <option value="Trưởng bộ môn" />
                    <option value="Phó Trưởng bộ môn" />
                    <option value="Trưởng khoa" />
                    <option value="Phó Trưởng khoa" />
                    <option value="Phó Trưởng khoa phụ trách học thuật" />
                    <option value="Trợ lý khoa học" />
                    <option value="Cán bộ khoa" />
                    <option value="Quản trị viên" />
                  </datalist>
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>Email liên hệ</span>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@truong.edu.vn"
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>Số điện thoại</span>
                  <input
                    type="tel"
                    value={editSdt}
                    onChange={(e) => setEditSdt(e.target.value)}
                    placeholder="0901xxxxxx"
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </label>

                {/* Bộ môn trực thuộc & phụ trách: 2 cột song song */}
                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                      Bộ môn trực thuộc &amp; phụ trách <span style={{ color: "#ef4444" }}>*</span>
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#64748b" }}>
                      (Có thể tích chọn 1 hoặc nhiều bộ môn cùng lúc)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      columnGap: "32px",
                      rowGap: "10px",
                      padding: "16px 20px",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                    }}
                  >
                    {sortedDepartments.map((d, i) => {
                      const id = Number(value(d, "MaBM"));
                      const isSelected = editMaBMList.includes(id);
                      return (
                        <label
                          key={`edit-dept-${id}-${i}`}
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: "10px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            userSelect: "none",
                            margin: 0,
                            transition: "background 0.15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditMaBMList([...editMaBMList, id]);
                              } else {
                                setEditMaBMList(editMaBMList.filter((m) => m !== id));
                              }
                            }}
                            style={{
                              width: "18px",
                              height: "18px",
                              minWidth: "18px",
                              minHeight: "18px",
                              maxWidth: "18px",
                              maxHeight: "18px",
                              margin: 0,
                              padding: 0,
                              cursor: "pointer",
                              accentColor: "#00bba7",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: "14px",
                              color: isSelected ? "#0f172a" : "#334155",
                              fontWeight: isSelected ? 600 : 400,
                              lineHeight: 1.4,
                            }}
                          >
                            {text(d, "TenBM")}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>Trạng thái hoạt động</span>
                  <select
                    value={editTrangThai}
                    onChange={(e) => setEditTrangThai(e.target.value)}
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <option value="Hoạt động">Hoạt động</option>
                    <option value="Khóa tạm thời">Khóa tạm thời</option>
                    <option value="Đã nghỉ">Đã nghỉ</option>
                  </select>
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "16px",
                  paddingTop: "20px",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <button
                  type="button"
                  style={{
                    height: "44px",
                    padding: "0 22px",
                    fontSize: "14.5px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => setEditingStaff(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={busy}
                  style={{
                    height: "44px",
                    padding: "0 28px",
                    fontSize: "14.5px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                    transition: "all 0.15s ease",
                    opacity: busy ? 0.7 : 1,
                  }}
                  onClick={handleUpdateStaff}
                >
                  {busy ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cấp tài khoản cho cán bộ chưa có tài khoản */}
      {grantingStaff && (
        <div className={s.modalOverlay}>
          <div
            className={s.modalBox}
            style={{
              maxWidth: "540px",
              width: "90%",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.2)",
            }}
          >
            <div className={s.modalHeader} style={{ padding: "20px 28px" }}>
              <h3 style={{ fontSize: "19px", fontWeight: 700, color: "#0f172a" }}>
                Cấp tài khoản đăng nhập
              </h3>
              <button
                className={s.modalClose}
                onClick={() => setGrantingStaff(null)}
                style={{ fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "24px 28px" }}>
              <p style={{ fontSize: "14.5px", color: "#334155", marginBottom: "18px" }}>
                Cấp tài khoản cho cán bộ / giảng viên:{" "}
                <strong style={{ color: "#0f172a" }}>{text(grantingStaff, "HoTen")}</strong>
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* 1. Tên đăng nhập */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                  <span>Tên đăng nhập <span style={{ color: "#ef4444" }}>*</span></span>
                  <input
                    value={grantUsername}
                    onChange={(e) => setGrantUsername(e.target.value)}
                    required
                    placeholder="ví dụ: gv.tuan"
                    style={{ height: "42px", padding: "0 12px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </label>

                {/* 2. Mật khẩu */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                  <span>Mật khẩu <span style={{ color: "#ef4444" }}>*</span></span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type={showGrantPassword ? "text" : "password"}
                      value={grantPassword}
                      onChange={(e) => setGrantPassword(e.target.value)}
                      required
                      placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                      style={{ height: "42px", padding: "0 40px 0 12px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", width: "100%" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowGrantPassword(!showGrantPassword)}
                      style={{
                        position: "absolute",
                        right: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0",
                        color: "#8290a4",
                        borderRadius: "6px",
                        transition: "color 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#2563eb"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#8290a4"; }}
                      title={showGrantPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      aria-label={showGrantPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      <EyeIcon visible={showGrantPassword} />
                    </button>
                  </div>
                </label>

                {/* 3. Xác nhận mật khẩu */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                  <span>Xác nhận mật khẩu <span style={{ color: "#ef4444" }}>*</span></span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type={showGrantConfirmPassword ? "text" : "password"}
                      value={grantConfirmPassword}
                      onChange={(e) => setGrantConfirmPassword(e.target.value)}
                      required
                      placeholder="Nhập lại mật khẩu để xác nhận"
                      style={{
                        height: "42px",
                        padding: "0 40px 0 12px",
                        fontSize: "14px",
                        borderRadius: "8px",
                        border: `1px solid ${grantConfirmPassword && grantPassword !== grantConfirmPassword ? "#ef4444" : "#cbd5e1"}`,
                        width: "100%",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowGrantConfirmPassword(!showGrantConfirmPassword)}
                      style={{
                        position: "absolute",
                        right: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0",
                        color: "#8290a4",
                        borderRadius: "6px",
                        transition: "color 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#2563eb"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#8290a4"; }}
                      title={showGrantConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      aria-label={showGrantConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      <EyeIcon visible={showGrantConfirmPassword} />
                    </button>
                  </div>
                  {grantConfirmPassword && grantPassword !== grantConfirmPassword && (
                    <span style={{ fontSize: "12.5px", color: "#ef4444", fontWeight: 500 }}>
                      ⚠️ Mật khẩu xác nhận không khớp
                    </span>
                  )}
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                  <span>Vai trò hệ thống <span style={{ color: "#ef4444" }}>*</span></span>
                  <select
                    value={grantRoleId}
                    onChange={(e) => setGrantRoleId(Number(e.target.value))}
                    required
                    style={{ height: "42px", padding: "0 12px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  >
                    {roles.map((r, i) => {
                      const id = Number(value(r, "MaVaiTro"));
                      return (
                        <option key={`grant-role-${id}-${i}`} value={id}>
                          {text(r, "TenVaiTro")}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "24px",
                  paddingTop: "18px",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <button
                  type="button"
                  style={{
                    height: "42px",
                    padding: "0 20px",
                    fontSize: "14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setGrantingStaff(null)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  style={{
                    height: "42px",
                    padding: "0 24px",
                    fontSize: "14px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: busy || (grantPassword !== grantConfirmPassword) ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                    opacity: busy || (grantPassword !== grantConfirmPassword) ? 0.7 : 1,
                  }}
                  disabled={busy || (grantPassword !== grantConfirmPassword)}
                  onClick={handleGrantAccount}
                >
                  {busy ? "Đang cấp…" : "Xác nhận cấp tài khoản"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa hồ sơ cán bộ / giảng viên */}
      {deletingStaff && (
        <div className={s.modalOverlay}>
          <div
            className={s.modalBox}
            style={{
              maxWidth: "540px",
              width: "90%",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.2)",
            }}
          >
            <div className={s.modalHeader} style={{ padding: "20px 28px" }}>
              <h3 style={{ color: "#b91c1c", fontSize: "19px", fontWeight: 700 }}>Xác nhận xóa hồ sơ</h3>
              <button
                className={s.modalClose}
                onClick={() => setDeletingStaff(null)}
                style={{ fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "24px 28px", color: "#334155", lineHeight: 1.6 }}>
              <p style={{ fontSize: "15px" }}>
                Bạn có chắc chắn muốn xóa hồ sơ cán bộ / giảng viên{" "}
                <strong style={{ color: "#0f172a" }}>{text(deletingStaff, "HoTen")}</strong> (Mã:{" "}
                <strong>{text(deletingStaff, "MaDinhDanh")}</strong>)?
              </p>
              <p style={{ fontSize: "13.5px", color: "#64748b", marginTop: "10px" }}>
                Thao tác này sẽ xóa hồ sơ và tài khoản đăng nhập tương ứng khỏi hệ thống.
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "24px",
                  paddingTop: "18px",
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <button
                  type="button"
                  style={{
                    height: "42px",
                    padding: "0 20px",
                    fontSize: "14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setDeletingStaff(null)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  style={{
                    height: "42px",
                    padding: "0 24px",
                    fontSize: "14px",
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(220, 38, 38, 0.25)",
                    opacity: busy ? 0.7 : 1,
                  }}
                  disabled={busy}
                  onClick={handleDeleteStaff}
                >
                  {busy ? "Đang xóa…" : "Xóa vĩnh viễn"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
