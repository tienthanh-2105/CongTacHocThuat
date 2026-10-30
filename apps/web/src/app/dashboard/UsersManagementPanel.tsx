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

export default function UsersManagementPanel({ currentUserId }: { currentUserId?: string | number }) {
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Modals
  const [showRoleMatrixModal, setShowRoleMatrixModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Row | null>(null);
  const [actionType, setActionType] = useState<"role" | "password" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      const [accRows, roleRows] = await Promise.all([
        workflowRequest<unknown>("/admin/accounts"),
        workflowRequest<unknown>("/admin/accounts/roles"),
      ]);
      setAccounts(Array.isArray(accRows) ? (accRows as Row[]) : []);
      setRoles(Array.isArray(roleRows) ? (roleRows as Row[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách tài khoản.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [accRows, roleRows] = await Promise.all([
          workflowRequest<unknown>("/admin/accounts"),
          workflowRequest<unknown>("/admin/accounts/roles"),
        ]);
        if (active) {
          setAccounts(Array.isArray(accRows) ? (accRows as Row[]) : []);
          setRoles(Array.isArray(roleRows) ? (roleRows as Row[]) : []);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách tài khoản.");
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  // Statistics
  const totalAccounts = accounts.length;
  const staffCount = accounts.filter((a) => {
    const loai = text(a, "LoaiDoiTuong");
    const vt = text(a, "TenVaiTro").toLowerCase();
    return loai === "CANBO" || vt.includes("giảng viên") || vt.includes("cán bộ") || vt.includes("quản trị");
  }).length;
  const studentCount = accounts.filter((a) => {
    const loai = text(a, "LoaiDoiTuong");
    const vt = text(a, "TenVaiTro").toLowerCase();
    return loai === "SINHVIEN" || vt.includes("sinh viên");
  }).length;
  const lockedCount = accounts.filter((a) => {
    const tt = text(a, "TrangThai").toLowerCase();
    return tt.includes("khóa") || tt.includes("ngừng") || tt.includes("tạm");
  }).length;

  // Filtered rows
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        text(acc, "HoTen").toLowerCase().includes(q) ||
        text(acc, "TenDangNhap").toLowerCase().includes(q) ||
        text(acc, "MaDinhDanh").toLowerCase().includes(q) ||
        text(acc, "Email").toLowerCase().includes(q) ||
        text(acc, "DonViLop").toLowerCase().includes(q) ||
        text(acc, "ChucVuVaiTro").toLowerCase().includes(q) ||
        text(acc, "TenVaiTro").toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterRole !== "all") {
        const roleMatch = text(acc, "TenVaiTro").toLowerCase().includes(filterRole.toLowerCase()) ||
                          text(acc, "ChucVuVaiTro").toLowerCase().includes(filterRole.toLowerCase());
        if (!roleMatch) return false;
      }

      if (filterStatus !== "all") {
        const tt = text(acc, "TrangThai").toLowerCase();
        if (filterStatus === "active" || filterStatus === "Hoạt động") {
          if (tt !== "hoạt động") return false;
        } else if (filterStatus === "locked" || filterStatus === "Đang khóa") {
          if (!tt.includes("khóa") && !tt.includes("ngừng") && !tt.includes("tạm")) return false;
        }
      }

      return true;
    });
  }, [accounts, search, filterRole, filterStatus]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRole, filterStatus]);

  // Pagination (10 người dùng 1 trang)
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedAccounts = useMemo(() => {
    return filteredAccounts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredAccounts, startIndex]);

  // Export CSV
  const exportCSV = () => {
    const headers = ["Họ tên", "Email", "Chức vụ / Vai trò", "Bộ môn / Lớp", "Trạng thái"];
    const rowsData = filteredAccounts.map((a) => [
      text(a, "HoTen"),
      text(a, "Email"),
      text(a, "ChucVuVaiTro") !== "—" ? text(a, "ChucVuVaiTro") : text(a, "TenVaiTro"),
      text(a, "DonViLop"),
      text(a, "TrangThai"),
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rowsData.map((e) => e.map((cell) => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Danh_sach_tai_khoan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle status
  async function toggleStatus(acc: Row) {
    const id = Number(value(acc, "MaTK"));
    const currentActive = text(acc, "TrangThai") === "Hoạt động";
    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/admin/accounts/${id}/status`, {
        method: "PATCH",
        body: { active: !currentActive },
      });
      setNotice(`Đã cập nhật trạng thái tài khoản ${text(acc, "TenDangNhap")}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được trạng thái tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  // Submit action (role or password)
  async function handleUpdateAction() {
    if (!editingAccount) return;
    const id = Number(value(editingAccount, "MaTK"));
    setBusy(true);
    setError("");
    try {
      if (actionType === "password") {
        if (!newPassword || newPassword.length < 6) {
          throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
        }
        await workflowRequest(`/admin/accounts/${id}/password`, {
          method: "PATCH",
          body: { password: newPassword },
        });
        setNotice(`Đã đặt lại mật khẩu cho tài khoản ${text(editingAccount, "TenDangNhap")}.`);
      } else if (actionType === "role") {
        await workflowRequest(`/admin/accounts/${id}/role`, {
          method: "PATCH",
          body: { roleId: Number(selectedRoleId) },
        });
        setNotice(`Đã cập nhật vai trò cho tài khoản ${text(editingAccount, "TenDangNhap")}.`);
      }
      setEditingAccount(null);
      setActionType(null);
      setNewPassword("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác không thành công.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.usersPanelWrapper}>
      {/* Alert notices */}
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

      {/* Top Header */}
      <div className={s.usersHeaderRow}>
        <div>
          <h1 className={s.usersPageTitle}>Tài khoản &amp; phân quyền</h1>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className={s.kpiGrid}>
        {/* Card 1 */}
        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Tổng tài khoản</span>
            <div className={`${s.kpiIconWrap} ${s.kpiBlue}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalAccounts.toLocaleString("vi-VN")}</div>
          <div className={s.kpiBadgeBlue}>+126 trong học kỳ</div>
        </div>

        {/* Card 2 */}
        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Giảng viên</span>
            <div className={`${s.kpiIconWrap} ${s.kpiPurple}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{staffCount}</div>
          <div className={s.kpiBadgePurple}>4 quản trị viên</div>
        </div>

        {/* Card 3 */}
        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Sinh viên</span>
            <div className={`${s.kpiIconWrap} ${s.kpiGreen}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{studentCount}</div>
          <div className={s.kpiBadgeGreen}>97,8% đã xác thực</div>
        </div>

        {/* Card 4 */}
        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Đang khóa</span>
            <div className={`${s.kpiIconWrap} ${s.kpiAmber}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{lockedCount}</div>
          <div className={s.kpiBadgeAmber}>Cần rà soát</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={s.usersToolbar}>
        <div className={s.searchField}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Tìm theo họ tên, email, vai trò, bộ môn/lớp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Lọc theo Vai trò */}
        <div className={s.filterDropdown}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">Tất cả vai trò</option>
            {roles.map((r, i) => (
              <option key={`role-opt-${i}`} value={text(r, "TenVaiTro")}>
                {text(r, "TenVaiTro")}
              </option>
            ))}
          </select>
        </div>

        {/* Lọc theo Trạng thái */}
        <div className={s.filterDropdown}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Đang khóa</option>
          </select>
        </div>

        <button className={s.exportBtn} onClick={() => void loadData()} title="Làm mới">🔄 Làm mới</button>
        <button className={s.exportBtn} onClick={exportCSV}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Xuất dữ liệu
        </button>
      </div>

      {/* Main Accounts Table */}
      <div className={s.tableCard}>
        <table className={s.modernTable}>
          <thead>
            <tr>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Họ tên</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Email</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Chức vụ / Vai trò</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Bộ môn / Lớp</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Trạng thái</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px", textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  Đang tải danh sách tài khoản…
                </td>
              </tr>
            ) : filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  Không tìm thấy tài khoản phù hợp với điều kiện tìm kiếm.
                </td>
              </tr>
            ) : (
              paginatedAccounts.map((acc, index) => {
                const id = Number(value(acc, "MaTK"));
                const hoTen = text(acc, "HoTen");
                const email = text(acc, "Email");
                const vaiTro = text(acc, "TenVaiTro");
                const chucVuVaiTro = text(acc, "ChucVuVaiTro") !== "—" ? text(acc, "ChucVuVaiTro") : text(acc, "TenVaiTro");
                const donViLop = text(acc, "DonViLop");
                const trangThai = text(acc, "TrangThai");
                const isCurrent = String(currentUserId) === String(id);

                let badgeClass = s.badgeGreen;
                if (trangThai.toLowerCase().includes("khóa") || trangThai.toLowerCase().includes("ngừng")) {
                  badgeClass = s.badgeRed;
                } else if (trangThai.toLowerCase().includes("chờ") || trangThai.toLowerCase().includes("chưa")) {
                  badgeClass = s.badgeAmber;
                }

                return (
                  <tr key={`acc-row-${id}-${index}`}>
                    {/* Họ tên */}
                    <td>
                      <span style={{ fontWeight: 400, color: "#1e293b", fontSize: "14px" }}>{hoTen}</span>
                    </td>

                    {/* Email */}
                    <td>
                      <span className={s.emailCell}>{email !== "—" ? email : "—"}</span>
                    </td>

                    {/* Chức vụ / Vai trò */}
                    <td>
                      <span style={{ fontWeight: 400, color: "#334155" }}>{chucVuVaiTro}</span>
                    </td>

                    {/* Bộ môn / Lớp */}
                    <td>
                      <span className={s.unitText} style={{ fontWeight: 400 }}>{donViLop}</span>
                    </td>

                    {/* Trạng thái */}
                    <td>
                      <span className={`${s.statusPill} ${badgeClass}`}>{trangThai}</span>
                    </td>

                    {/* Thao tác (đổi mật khẩu, khóa tài khoản) */}
                    <td style={{ textAlign: "right" }}>
                      <div className={s.rowActions}>
                        <button
                          type="button"
                          title="Đặt lại mật khẩu"
                          className={s.rowActionBtn}
                          onClick={() => {
                            setEditingAccount(acc);
                            setActionType("password");
                            setNewPassword("");
                          }}
                        >
                          🔑 Đổi MK
                        </button>
                        <button
                          type="button"
                          title={trangThai === "Hoạt động" ? "Khóa tài khoản" : "Kích hoạt tài khoản"}
                          className={`${s.rowActionBtn} ${trangThai === "Hoạt động" ? s.actionLock : s.actionUnlock}`}
                          disabled={isCurrent}
                          onClick={() => toggleStatus(acc)}
                        >
                          {trangThai === "Hoạt động" ? "🔒 Khóa" : "🔓 Mở"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Phân trang: 10 người dùng 1 trang */}
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
            {filteredAccounts.length > 0 ? (
              <span>
                Hiển thị{" "}
                <strong style={{ color: "#1e293b" }}>{startIndex + 1}</strong> –{" "}
                <strong style={{ color: "#1e293b" }}>
                  {Math.min(startIndex + PAGE_SIZE, filteredAccounts.length)}
                </strong>{" "}
                trên tổng số{" "}
                <strong style={{ color: "#1e293b" }}>{filteredAccounts.length}</strong> tài khoản
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

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const isActive = page === safeCurrentPage;
                return (
                  <button
                    key={`page-${page}`}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    style={{
                      width: "36px",
                      height: "36px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px",
                      border: isActive ? "1px solid #2563eb" : "1px solid #cbd5e1",
                      background: isActive ? "#2563eb" : "#ffffff",
                      color: isActive ? "#ffffff" : "#334155",
                      fontSize: "13.5px",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {page}
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

      {/* Bottom Section: Role Matrix & Activity Log */}
      <div className={s.bottomGrid}>
        {/* Left: Role Matrix Card */}
        <div className={s.matrixCard}>
          <div className={s.matrixHeader}>
            <div>
              <h2 className={s.matrixTitle}>Ma trận vai trò</h2>
              <p className={s.matrixSubtitle}>6 vai trò · 28 quyền hệ thống</p>
            </div>
            <button className={s.configBtn} onClick={() => setShowRoleMatrixModal(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Cấu hình
            </button>
          </div>

          <div className={s.roleCardsGrid}>
            <div className={s.roleMiniCard}>
              <div className={s.roleIconBadge}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <strong>Quản trị khoa</strong>
                <p>Toàn bộ dữ liệu</p>
              </div>
            </div>

            <div className={s.roleMiniCard}>
              <div className={s.roleIconBadge}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <strong>Trưởng bộ môn</strong>
                <p>Kế hoạch &amp; báo cáo</p>
              </div>
            </div>

            <div className={s.roleMiniCard}>
              <div className={s.roleIconBadge}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="2" />
                  <line x1="15" y1="8" x2="17" y2="8" />
                  <line x1="15" y1="12" x2="17" y2="12" />
                  <line x1="7" y1="16" x2="17" y2="16" />
                </svg>
              </div>
              <div>
                <strong>Chủ nhiệm lớp</strong>
                <p>Sinh viên &amp; phân bổ</p>
              </div>
            </div>

            <div className={s.roleMiniCard}>
              <div className={s.roleIconBadge}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div>
                <strong>Giảng viên</strong>
                <p>Hoạt động phụ trách</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Activity Log Card */}
        <div className={s.logCard}>
          <div className={s.logHeader}>
            <h2 className={s.logTitle}>Nhật ký gần đây</h2>
            <p className={s.logSubtitle}>Hoạt động quản trị</p>
          </div>

          <div className={s.logTimeline}>
            <div className={s.logItem}>
              <span className={s.logDot} />
              <div className={s.logContent}>
                <strong className={s.logAction}>Cập nhật vai trò GV0061</strong>
                <span className={s.logMeta}>1 giờ trước · Nguyễn Minh Anh</span>
              </div>
            </div>

            <div className={s.logItem}>
              <span className={s.logDot} />
              <div className={s.logContent}>
                <strong className={s.logAction}>Khóa tài khoản GV0082</strong>
                <span className={s.logMeta}>2 giờ trước · Nguyễn Minh Anh</span>
              </div>
            </div>

            <div className={s.logItem}>
              <span className={s.logDot} />
              <div className={s.logContent}>
                <strong className={s.logAction}>Nhập 126 sinh viên khóa 2026</strong>
                <span className={s.logMeta}>3 giờ trước · Nguyễn Minh Anh</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Đổi mật khẩu */}
      {editingAccount && actionType && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <div className={s.modalHeader}>
              <h3>
                {actionType === "role" ? "Phân lại vai trò" : "Đặt lại mật khẩu"} - {text(editingAccount, "TenDangNhap")}
              </h3>
              <button
                className={s.modalClose}
                onClick={() => {
                  setEditingAccount(null);
                  setActionType(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className={s.modalForm}>
              {actionType === "role" ? (
                <label>
                  <span>Chọn vai trò mới:</span>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    style={{ marginTop: "8px" }}
                  >
                    {roles.map((r, i) => (
                      <option key={`role-chg-${i}`} value={String(value(r, "MaVaiTro"))}>
                        {text(r, "TenVaiTro")}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  <span>Mật khẩu mới (tối thiểu 6 ký tự):</span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", marginTop: "8px" }}>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      minLength={6}
                      value={newPassword}
                      placeholder="Nhập mật khẩu mới..."
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ paddingRight: "40px", width: "100%" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
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
                      title={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      aria-label={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      <EyeIcon visible={showNewPassword} />
                    </button>
                  </div>
                </label>
              )}

              <div className={s.modalActions}>
                <button
                  type="button"
                  className={s.cancelBtn}
                  onClick={() => {
                    setEditingAccount(null);
                    setActionType(null);
                  }}
                >
                  Hủy
                </button>
                <button type="button" className={s.submitBtn} disabled={busy} onClick={handleUpdateAction}>
                  {busy ? "Đang lưu…" : "Xác nhận"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cấu hình ma trận vai trò */}
      {showRoleMatrixModal && (
        <div className={s.modalOverlay}>
          <div className={`${s.modalBox} ${s.modalBoxLarge}`}>
            <div className={s.modalHeader}>
              <h3>Cấu hình Ma trận Vai trò &amp; Phân quyền</h3>
              <button className={s.modalClose} onClick={() => setShowRoleMatrixModal(false)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "20px 24px", color: "#334155", lineHeight: 1.6 }}>
              <p>Hệ thống hiện tại áp dụng phân quyền dựa trên vai trò (Role-Based Access Control):</p>
              <ul style={{ paddingLeft: "20px", marginTop: "12px", display: "grid", gap: "8px" }}>
                <li><strong>Quản trị khoa (ADMIN):</strong> Toàn quyền quản trị tài khoản, danh mục khoa/bộ môn/lớp, phê duyệt kế hoạch và phân bổ toàn trường.</li>
                <li><strong>Cán bộ khoa (CANBOKHOA):</strong> Quản lý hoạt động học thuật, phê duyệt hồ sơ quyết toán, tổng hợp báo cáo cấp khoa.</li>
                <li><strong>Trưởng bộ môn / Giảng viên (GIANGVIEN):</strong> Lập kế hoạch hoạt động bộ môn, ban chỉ đạo, ban tổ chức, ban giám khảo cuộc thi và seminar.</li>
                <li><strong>Sinh viên (SINHVIEN):</strong> Đăng ký tham gia hoạt động, dự thi theo đội, đăng ký cổ vũ, điểm danh mã QR và xem điểm rèn luyện.</li>
              </ul>
              <div style={{ marginTop: "20px", textAlign: "right" }}>
                <button className={s.submitBtn} onClick={() => setShowRoleMatrixModal(false)}>
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
