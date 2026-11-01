"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { workflowRequest } from "@/services/workflow";
import s from "./dashboard.module.css";
import NoticeDialog from "./NoticeDialog";

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

export default function StudentProfilesPanel() {
  const [students, setStudents] = useState<Row[]>([]);
  const [classes, setClasses] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Create modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHoTen, setNewHoTen] = useState("");
  const [newMssv, setNewMssv] = useState("");
  const [newMaLop, setNewMaLop] = useState<number | "">("");
  const [newEmail, setNewEmail] = useState("");
  const [newSdt, setNewSdt] = useState("");
  const [newNgaySinh, setNewNgaySinh] = useState("");
  const [newGioiTinh, setNewGioiTinh] = useState("Nam");
  const [newCreateAccount, setNewCreateAccount] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("HocThuat@2026");
  const [newRoleId, setNewRoleId] = useState<number | "">("");

  // Edit modal state
  const [editingStudent, setEditingStudent] = useState<Row | null>(null);
  const [editHoTen, setEditHoTen] = useState("");
  const [editMssv, setEditMssv] = useState("");
  const [editMaLop, setEditMaLop] = useState<number | "">("");
  const [editEmail, setEditEmail] = useState("");
  const [editSdt, setEditSdt] = useState("");
  const [editNgaySinh, setEditNgaySinh] = useState("");
  const [editGioiTinh, setEditGioiTinh] = useState("");

  // Grant account modal state (cho sinh viên chưa có tài khoản)
  const [grantingStudent, setGrantingStudent] = useState<Row | null>(null);
  const [grantUsername, setGrantUsername] = useState("");
  const [grantPassword, setGrantPassword] = useState("HocThuat@2026");
  const [grantConfirmPassword, setGrantConfirmPassword] = useState("HocThuat@2026");
  const [showGrantPassword, setShowGrantPassword] = useState(false);
  const [showGrantConfirmPassword, setShowGrantConfirmPassword] = useState(false);
  const [grantRoleId, setGrantRoleId] = useState<number | "">("");

  // Delete modal state
  const [deletingStudent, setDeletingStudent] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [studentRows, classRows, roleRows] = await Promise.all([
        workflowRequest<unknown>("/admin/accounts/student-records"),
        workflowRequest<unknown>("/admin/accounts/student-classes").catch(() => []),
        workflowRequest<unknown>("/admin/accounts/roles").catch(() => []),
      ]);
      setStudents(Array.isArray(studentRows) ? (studentRows as Row[]) : []);
      setClasses(Array.isArray(classRows) ? (classRows as Row[]) : []);
      setRoles(Array.isArray(roleRows) ? (roleRows as Row[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách hồ sơ sinh viên.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [studentRows, classRows, roleRows] = await Promise.all([
          workflowRequest<unknown>("/admin/accounts/student-records"),
          workflowRequest<unknown>("/admin/accounts/student-classes").catch(() => []),
          workflowRequest<unknown>("/admin/accounts/roles").catch(() => []),
        ]);
        if (active) {
          setStudents(Array.isArray(studentRows) ? (studentRows as Row[]) : []);
          setClasses(Array.isArray(classRows) ? (classRows as Row[]) : []);
          setRoles(Array.isArray(roleRows) ? (roleRows as Row[]) : []);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách hồ sơ sinh viên.");
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Metrics
  const totalStudents = students.length;
  const linkedCount = students.filter((st) => text(st, "TenDangNhap") !== "—").length;
  const unlinkedCount = totalStudents - linkedCount;
  const totalClasses = classes.length;

  // Filtered rows
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        text(st, "HoTen").toLowerCase().includes(q) ||
        text(st, "MSSV").toLowerCase().includes(q) ||
        text(st, "Email").toLowerCase().includes(q) ||
        text(st, "SDT").toLowerCase().includes(q) ||
        text(st, "TenLop").toLowerCase().includes(q) ||
        text(st, "TenKhoa").toLowerCase().includes(q) ||
        text(st, "KhoaHoc").toLowerCase().includes(q) ||
        text(st, "TenDangNhap").toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (classFilter !== "all") {
        if (String(value(st, "MaLop")) !== classFilter && text(st, "TenLop") !== classFilter) {
          return false;
        }
      }

      if (accountFilter === "has_account") {
        if (text(st, "TenDangNhap") === "—") return false;
      } else if (accountFilter === "no_account") {
        if (text(st, "TenDangNhap") !== "—") return false;
      }

      return true;
    });
  }, [students, search, classFilter, accountFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, classFilter, accountFilter]);

  // Pagination (10 sinh viên 1 trang)
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredStudents, startIndex]);

  // Open Create Modal
  function openCreateModal() {
    setNewHoTen("");
    setNewMssv("");
    setNewMaLop(classes.length > 0 ? Number(value(classes[0], "MaLop")) : "");
    setNewEmail("");
    setNewSdt("");
    setNewNgaySinh("");
    setNewGioiTinh("Nam");
    setNewCreateAccount(false);
    setNewUsername("");
    setNewPassword("HocThuat@2026");
    const svRole = roles.find((r) => String(value(r, "TenVaiTro")).toUpperCase().includes("SINH"));
    setNewRoleId(svRole ? Number(value(svRole, "MaVaiTro")) : 4);
    setShowAddModal(true);
  }

  // Handle Create Student
  async function handleCreateStudent() {
    if (!newHoTen.trim()) {
      setError("Vui lòng nhập họ và tên sinh viên.");
      return;
    }
    if (!newMssv.trim()) {
      setError("Vui lòng nhập MSSV.");
      return;
    }
    if (!newMaLop) {
      setError("Vui lòng chọn lớp học.");
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
      const created = await workflowRequest<Row>("/admin/accounts/student-profiles", {
        method: "POST",
        body: {
          hoTen: newHoTen.trim(),
          mssv: newMssv.trim(),
          maLop: Number(newMaLop),
          email: newEmail.trim() || undefined,
          sdt: newSdt.trim() || undefined,
          ngaySinh: newNgaySinh || undefined,
          gioiTinh: newGioiTinh || undefined,
        },
      });

      const maSV = Number(value(created, "MaSV"));
      if (newCreateAccount && maSV) {
        await workflowRequest(`/admin/accounts/student-records/${maSV}/account`, {
          method: "POST",
          body: {
            username: newUsername.trim(),
            password: newPassword,
            roleId: newRoleId ? Number(newRoleId) : 4,
          },
        });
      }

      setNotice(`Đã thêm thành công hồ sơ sinh viên ${newHoTen.trim()} (MSSV: ${newMssv.trim()})${newCreateAccount ? ` kèm tài khoản "${newUsername.trim()}"` : ""}.`);
      setShowAddModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thêm hồ sơ sinh viên thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Open Edit Modal
  function openEditModal(st: Row) {
    setEditingStudent(st);
    setEditHoTen(text(st, "HoTen") !== "—" ? text(st, "HoTen") : "");
    setEditMssv(text(st, "MSSV") !== "—" ? text(st, "MSSV") : "");
    const ml = value(st, "MaLop");
    setEditMaLop(ml ? Number(ml) : "");
    setEditEmail(text(st, "Email") !== "—" ? text(st, "Email") : "");
    setEditSdt(text(st, "SDT") !== "—" ? text(st, "SDT") : "");
    const ns = text(st, "NgaySinh");
    setEditNgaySinh(ns !== "—" ? ns.slice(0, 10) : "");
    setEditGioiTinh(text(st, "GioiTinh") !== "—" ? text(st, "GioiTinh") : "Nam");
  }

  // Handle Update Student
  async function handleUpdateStudent() {
    if (!editingStudent) return;
    const maSV = Number(value(editingStudent, "MaSV"));
    if (!maSV) return;

    if (!editHoTen.trim()) {
      setError("Vui lòng nhập họ và tên.");
      return;
    }
    if (!editMssv.trim()) {
      setError("Vui lòng nhập MSSV.");
      return;
    }
    if (!editMaLop) {
      setError("Vui lòng chọn lớp học.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/admin/accounts/student-records/${maSV}`, {
        method: "PATCH",
        body: {
          hoTen: editHoTen.trim(),
          mssv: editMssv.trim(),
          maLop: Number(editMaLop),
          email: editEmail.trim() || undefined,
          sdt: editSdt.trim() || undefined,
          ngaySinh: editNgaySinh || undefined,
          gioiTinh: editGioiTinh || undefined,
        },
      });
      setNotice(`Đã cập nhật thông tin sinh viên ${editHoTen.trim()} thành công.`);
      setEditingStudent(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Open Grant Account Modal (giống hệt trang hồ sơ cán bộ)
  function openGrantModal(st: Row) {
    setGrantingStudent(st);
    const mssv = text(st, "MSSV");
    const email = text(st, "Email");
    const defaultUsername = mssv !== "—" && mssv.trim()
      ? mssv.trim()
      : (email !== "—" && email.includes("@") ? email.split("@")[0] : `sv.${text(st, "HoTen").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")}`);
    setGrantUsername(defaultUsername);
    setGrantPassword("HocThuat@2026");
    setGrantConfirmPassword("HocThuat@2026");
    setShowGrantPassword(false);
    setShowGrantConfirmPassword(false);
    const svRole = roles.find((r) => String(value(r, "TenVaiTro")).toUpperCase().includes("SINH"));
    setGrantRoleId(svRole ? Number(value(svRole, "MaVaiTro")) : 4);
  }

  // Handle Grant Account
  async function handleGrantAccount() {
    if (!grantingStudent) return;
    const maSV = Number(value(grantingStudent, "MaSV"));
    if (!maSV) return;

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
      await workflowRequest(`/admin/accounts/student-records/${maSV}/account`, {
        method: "POST",
        body: {
          username: grantUsername.trim(),
          password: grantPassword,
          roleId: Number(grantRoleId),
        },
      });
      setNotice(`Đã cấp thành công tài khoản "${grantUsername.trim()}" (Mật khẩu: "${grantPassword}") cho sinh viên ${text(grantingStudent, "HoTen")}.`);
      setGrantingStudent(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cấp tài khoản thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Handle Delete Student
  async function handleDeleteStudent() {
    if (!deletingStudent) return;
    const maSV = Number(value(deletingStudent, "MaSV"));
    if (!maSV) return;

    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/admin/accounts/student-records/${maSV}`, {
        method: "DELETE",
      });
      setNotice(`Đã xóa hồ sơ của sinh viên ${text(deletingStudent, "HoTen")} thành công.`);
      setDeletingStudent(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa hồ sơ thất bại.");
    } finally {
      setBusy(false);
    }
  }

  // Export CSV
  const exportCSV = () => {
    const headers = ["MSSV", "Họ tên sinh viên", "Lớp", "Khóa học", "Khoa", "Email", "SĐT", "Tài khoản", "Trạng thái"];
    const rowsData = filteredStudents.map((st) => [
      text(st, "MSSV"),
      text(st, "HoTen"),
      text(st, "TenLop"),
      text(st, "KhoaHoc"),
      text(st, "TenKhoa"),
      text(st, "Email"),
      text(st, "SDT"),
      text(st, "TenDangNhap"),
      text(st, "TrangThai"),
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rowsData.map((e) => e.map((cell) => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ho_so_sinh_vien_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={s.usersPanelWrapper}>
      {error ? <NoticeDialog message={error} kind="error" onClose={() => setError("")} /> : notice ? <NoticeDialog message={notice} kind="success" onClose={() => setNotice("")} /> : null}

      {/* Header Row */}
      <div className={s.usersHeaderRow}>
        <div>
          <h1 className={s.usersPageTitle}>Hồ sơ sinh viên</h1>
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
          Thêm sinh viên
        </button>
      </div>

      {/* KPI Cards */}
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Tổng số sinh viên</span>
            <div className={`${s.kpiIconWrap} ${s.kpiBlue}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalStudents}</div>
          <div className={s.kpiBadgeBlue}>Tất cả các khóa &amp; lớp</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Đã có tài khoản</span>
            <div className={`${s.kpiIconWrap} ${s.kpiGreen}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{linkedCount}</div>
          <div className={s.kpiBadgeGreen}>
            {totalStudents > 0 ? Math.round((linkedCount / totalStudents) * 100) : 0}% đã sẵn sàng
          </div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Chưa có tài khoản</span>
            <div className={`${s.kpiIconWrap} ${s.kpiAmber}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{unlinkedCount}</div>
          <div className={s.kpiBadgeAmber}>Cần cấp tài khoản</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Lớp sinh viên</span>
            <div className={`${s.kpiIconWrap} ${s.kpiPurple}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalClasses}</div>
          <div className={s.kpiBadgePurple}>Lớp đang quản lý</div>
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
            placeholder="Tìm theo MSSV, họ tên, lớp, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={s.filterDropdown}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="all">Tất cả lớp</option>
            {classes.map((c, i) => {
              const id = text(c, "MaLop");
              const ten = text(c, "TenLop");
              return (
                <option key={`cls-${id}-${i}`} value={id}>
                  {ten}
                </option>
              );
            })}
          </select>
        </div>

        <div className={s.filterDropdown}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="all">Tất cả trạng thái TK</option>
            <option value="has_account">Đã có tài khoản</option>
            <option value="no_account">Chưa có tài khoản</option>
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

      {/* Table */}
      <div className={s.tableCard}>
        <table className={s.modernTable}>
          <thead>
            <tr>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>MSSV</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Họ tên sinh viên</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Lớp</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Khóa học &amp; Khoa</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Email &amp; SĐT</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Tài khoản</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  Đang tải danh sách hồ sơ sinh viên…
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  Không tìm thấy hồ sơ sinh viên phù hợp.
                </td>
              </tr>
            ) : (
              paginatedStudents.map((st, index) => {
                const id = Number(value(st, "MaSV"));
                const mssv = text(st, "MSSV");
                const hoTen = text(st, "HoTen");
                const tenLop = text(st, "TenLop");
                const khoaHoc = text(st, "KhoaHoc");
                const tenKhoa = text(st, "TenKhoa");
                const email = text(st, "Email");
                const sdt = text(st, "SDT");
                const ngaySinh = text(st, "NgaySinh");
                const gioiTinh = text(st, "GioiTinh");
                const username = text(st, "TenDangNhap");
                const hasAccount = username !== "—";

                return (
                  <tr key={`student-row-${id}-${index}`}>
                    {/* MSSV */}
                    <td>
                      <span style={{ fontWeight: 600, color: "#1e293b", fontFamily: "monospace", fontSize: "14px" }}>
                        {mssv}
                      </span>
                    </td>

                    {/* Họ tên sinh viên */}
                    <td>
                      <div style={{ fontWeight: 500, color: "#0f172a", fontSize: "14px" }}>{hoTen}</div>
                      {gioiTinh !== "—" && (
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {gioiTinh}{ngaySinh !== "—" ? ` · ${new Date(ngaySinh).toLocaleDateString("vi-VN")}` : ""}
                        </div>
                      )}
                    </td>

                    {/* Lớp */}
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 9px",
                          borderRadius: "6px",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontSize: "13px",
                          fontWeight: 600,
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        {tenLop}
                      </span>
                    </td>

                    {/* Khóa học & Khoa */}
                    <td>
                      <div style={{ color: "#334155", fontSize: "13.5px" }}>{tenKhoa}</div>
                      {khoaHoc !== "—" && <div style={{ fontSize: "12px", color: "#64748b" }}>{khoaHoc}</div>}
                    </td>

                    {/* Email & Số điện thoại */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span className={s.emailCell}>{email}</span>
                        {sdt !== "—" && <span style={{ fontSize: "12px", color: "#64748b" }}>{sdt}</span>}
                      </div>
                    </td>

                    {/* Tài khoản */}
                    <td>
                      {hasAccount ? (
                        <span
                          className={`${s.statusPill} ${s.badgeGreen}`}
                          title={`Tài khoản: ${username}`}
                        >
                          👤 {username}
                        </span>
                      ) : (
                        <span
                          className={`${s.statusPill} ${s.badgeAmber}`}
                          style={{ background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" }}
                        >
                          Chưa có TK
                        </span>
                      )}
                    </td>

                    {/* Thao tác (sửa, cấp tài khoản, xóa - giống hệt trang hồ sơ cán bộ) */}
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
                          onClick={() => setDeletingStudent(st)}
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

        {/* Phân trang: 10 sinh viên 1 trang */}
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
            {filteredStudents.length > 0 ? (
              <span>
                Hiển thị{" "}
                <strong style={{ color: "#1e293b" }}>{startIndex + 1}</strong> –{" "}
                <strong style={{ color: "#1e293b" }}>
                  {Math.min(startIndex + PAGE_SIZE, filteredStudents.length)}
                </strong>{" "}
                trên tổng số{" "}
                <strong style={{ color: "#1e293b" }}>{filteredStudents.length}</strong> sinh viên
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

      {/* Modal: Thêm mới sinh viên */}
      {showAddModal && (
        <div className={s.modalOverlay}>
          <div
            className={s.modalBox}
            style={{
              maxWidth: "700px",
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
                Thêm mới hồ sơ sinh viên
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
                  gap: "20px 24px",
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
                    Họ và tên sinh viên <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    value={newHoTen}
                    onChange={(e) => setNewHoTen(e.target.value)}
                    required
                    placeholder="ví dụ: Nguyễn Văn An"
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
                    Mã số sinh viên (MSSV) <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    value={newMssv}
                    onChange={(e) => {
                      setNewMssv(e.target.value);
                      if (!newUsername) setNewUsername(e.target.value);
                    }}
                    required
                    placeholder="ví dụ: 2001220001"
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
                    Lớp sinh hoạt <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <select
                    value={newMaLop}
                    onChange={(e) => setNewMaLop(Number(e.target.value))}
                    required
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <option value="">Chọn lớp học</option>
                    {classes.map((c, i) => {
                      const id = Number(value(c, "MaLop"));
                      return (
                        <option key={`opt-cls-${id}-${i}`} value={id}>
                          {text(c, "TenLop")} · {text(c, "KhoaHoc")} · {text(c, "TenKhoa")}
                        </option>
                      );
                    })}
                  </select>
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
                  <span>Giới tính</span>
                  <select
                    value={newGioiTinh}
                    onChange={(e) => setNewGioiTinh(e.target.value)}
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
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
                  <span>Email</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="sinhvien@truong.edu.vn"
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

                <label
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>Ngày sinh</span>
                  <input
                    type="date"
                    value={newNgaySinh}
                    onChange={(e) => setNewNgaySinh(e.target.value)}
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </label>

                {/* Checkbox: Cấp tài khoản ngay */}
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "16px 20px",
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      fontSize: "14.5px",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newCreateAccount}
                      onChange={(e) => {
                        setNewCreateAccount(e.target.checked);
                        if (e.target.checked && !newUsername) {
                          setNewUsername(newMssv);
                        }
                      }}
                      style={{
                        width: "18px",
                        height: "18px",
                        accentColor: "#2563eb",
                        cursor: "pointer",
                      }}
                    />
                    <span>Cấp tài khoản đăng nhập ngay cho sinh viên này</span>
                  </label>

                  {newCreateAccount && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "16px",
                        marginTop: "16px",
                        paddingTop: "16px",
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                        <span>Tên đăng nhập <span style={{ color: "#ef4444" }}>*</span></span>
                        <input
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Mặc định là MSSV"
                          style={{ height: "40px", padding: "0 12px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                        />
                      </label>

                      <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                        <span>Mật khẩu khởi tạo <span style={{ color: "#ef4444" }}>*</span></span>
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          style={{ height: "40px", padding: "0 12px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "20px",
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
                  onClick={handleCreateStudent}
                >
                  {busy ? "Đang lưu…" : "Thêm hồ sơ sinh viên"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa hồ sơ sinh viên */}
      {editingStudent && (
        <div className={s.modalOverlay}>
          <div
            className={s.modalBox}
            style={{
              maxWidth: "700px",
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
                Chỉnh sửa hồ sơ sinh viên
              </h3>
              <button
                className={s.modalClose}
                onClick={() => setEditingStudent(null)}
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
                  gap: "20px 24px",
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
                    Họ và tên sinh viên <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    value={editHoTen}
                    onChange={(e) => setEditHoTen(e.target.value)}
                    required
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
                    Mã số sinh viên (MSSV) <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <input
                    value={editMssv}
                    onChange={(e) => setEditMssv(e.target.value)}
                    required
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
                    Lớp sinh hoạt <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <select
                    value={editMaLop}
                    onChange={(e) => setEditMaLop(Number(e.target.value))}
                    required
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <option value="">Chọn lớp học</option>
                    {classes.map((c, i) => {
                      const id = Number(value(c, "MaLop"));
                      return (
                        <option key={`edit-cls-${id}-${i}`} value={id}>
                          {text(c, "TenLop")} · {text(c, "KhoaHoc")} · {text(c, "TenKhoa")}
                        </option>
                      );
                    })}
                  </select>
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
                  <span>Giới tính</span>
                  <select
                    value={editGioiTinh}
                    onChange={(e) => setEditGioiTinh(e.target.value)}
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
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
                  <span>Email</span>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
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
                    gridColumn: "1 / -1",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  <span>Ngày sinh</span>
                  <input
                    type="date"
                    value={editNgaySinh}
                    onChange={(e) => setEditNgaySinh(e.target.value)}
                    style={{
                      height: "44px",
                      padding: "0 14px",
                      fontSize: "14.5px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "20px",
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
                  onClick={() => setEditingStudent(null)}
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
                  onClick={handleUpdateStudent}
                >
                  {busy ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cấp tài khoản cho sinh viên chưa có tài khoản (giống hệt trang hồ sơ cán bộ) */}
      {grantingStudent && (
        <div className={s.modalOverlay}>
          <div
            className={s.modalBox}
            style={{
              maxWidth: "520px",
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
                onClick={() => setGrantingStudent(null)}
                style={{ fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "24px 28px" }}>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "20px",
                }}
              >
                <div style={{ fontSize: "13px", color: "#64748b" }}>Cấp tài khoản cho sinh viên:</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                  {text(grantingStudent, "HoTen")}
                </div>
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <span>MSSV: <strong style={{ color: "#2563eb" }}>{text(grantingStudent, "MSSV")}</strong></span>
                  <span>·</span>
                  <span>Lớp: <strong>{text(grantingStudent, "TenLop")}</strong></span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* 1. Tên đăng nhập */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                  <span>Tên đăng nhập <span style={{ color: "#ef4444" }}>*</span></span>
                  <input
                    value={grantUsername}
                    onChange={(e) => setGrantUsername(e.target.value)}
                    required
                    placeholder="ví dụ: 2001220001"
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

                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "13px", color: "#1d4ed8" }}>
                  <span>🛡️</span>
                  <span>Vai trò cấp mặc định: <strong>Sinh viên</strong></span>
                </div>
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
                  onClick={() => setGrantingStudent(null)}
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

      {/* Modal: Xác nhận xóa hồ sơ sinh viên */}
      {deletingStudent && (
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
                onClick={() => setDeletingStudent(null)}
                style={{ fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "24px 28px", color: "#334155", lineHeight: 1.6 }}>
              <p style={{ fontSize: "15px" }}>
                Bạn có chắc chắn muốn xóa hồ sơ sinh viên{" "}
                <strong style={{ color: "#0f172a" }}>{text(deletingStudent, "HoTen")}</strong> (MSSV:{" "}
                <strong>{text(deletingStudent, "MSSV")}</strong>)?
              </p>
              <p style={{ fontSize: "13.5px", color: "#64748b", marginTop: "10px" }}>
                Thao tác này sẽ xóa toàn bộ hồ sơ, dữ liệu liên quan và tài khoản đăng nhập tương ứng khỏi hệ thống.
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
                  onClick={() => setDeletingStudent(null)}
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
                  onClick={handleDeleteStudent}
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
