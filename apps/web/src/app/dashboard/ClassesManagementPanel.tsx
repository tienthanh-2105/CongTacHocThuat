"use client";

import { useCallback, useEffect, useState, useMemo, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;

const value = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const actual = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const result = actual ? row[actual] : undefined;
    if (result !== undefined && result !== null && result !== "") return result;
  }
  return undefined;
};

const text = (row: Row, ...keys: string[]) => {
  const result = value(row, ...keys);
  return result === undefined ? "—" : String(result);
};

export default function ClassesManagementPanel() {
  const [classes, setClasses] = useState<Row[]>([]);
  const [faculties, setFaculties] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterFaculty, setFilterFaculty] = useState("all");
  const [filterCohort, setFilterCohort] = useState("all");

  // Create Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTenLop, setNewTenLop] = useState("");
  const [newMaKhoa, setNewMaKhoa] = useState<number | "">("");
  const [newKhoaHoc, setNewKhoaHoc] = useState("");

  // Edit Modal State
  const [editingClass, setEditingClass] = useState<Row | null>(null);
  const [editTenLop, setEditTenLop] = useState("");
  const [editMaKhoa, setEditMaKhoa] = useState<number | "">("");
  const [editKhoaHoc, setEditKhoaHoc] = useState("");

  // Delete Confirm State
  const [deletingClass, setDeletingClass] = useState<Row | null>(null);

  // View Students Modal State
  const [viewingClass, setViewingClass] = useState<Row | null>(null);
  const [classStudents, setClassStudents] = useState<Row[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [classRows, facRows] = await Promise.all([
        workflowRequest<unknown>("/admin/accounts/classes"),
        workflowRequest<unknown>("/admin/accounts/faculties").catch(() => []),
      ]);
      setClasses(Array.isArray(classRows) ? (classRows as Row[]) : []);
      setFaculties(Array.isArray(facRows) ? (facRows as Row[]) : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách lớp học.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [classRows, facRows] = await Promise.all([
          workflowRequest<unknown>("/admin/accounts/classes"),
          workflowRequest<unknown>("/admin/accounts/faculties").catch(() => []),
        ]);
        if (active) {
          setClasses(Array.isArray(classRows) ? (classRows as Row[]) : []);
          setFaculties(Array.isArray(facRows) ? (facRows as Row[]) : []);
          setLoading(false);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Không tải được danh sách lớp học.");
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Distinct Khóa học list
  const cohorts = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((c) => {
      const kh = text(c, "KhoaHoc");
      if (kh !== "—") set.add(kh);
    });
    return Array.from(set).sort();
  }, [classes]);

  // Distinct Khoa list
  const facultyList = useMemo(() => {
    if (faculties.length > 0) return faculties;
    const map = new Map<number, string>();
    classes.forEach((c) => {
      const id = Number(value(c, "MaKhoa"));
      const ten = text(c, "TenKhoa");
      if (id && ten !== "—" && !map.has(id)) {
        map.set(id, ten);
      }
    });
    return Array.from(map.entries()).map(([MaKhoa, TenKhoa]) => ({ MaKhoa, TenKhoa }));
  }, [faculties, classes]);

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        text(c, "TenLop").toLowerCase().includes(q) ||
        text(c, "TenKhoa").toLowerCase().includes(q) ||
        text(c, "KhoaHoc").toLowerCase().includes(q) ||
        text(c, "MaLop").toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (filterFaculty !== "all" && text(c, "TenKhoa") !== filterFaculty) return false;
      if (filterCohort !== "all" && text(c, "KhoaHoc") !== filterCohort) return false;

      return true;
    });
  }, [classes, search, filterFaculty, filterCohort]);

  // Metrics
  const totalClasses = classes.length;
  const totalStudents = classes.reduce((sum, c) => sum + (Number(value(c, "SiSo")) || 0), 0);
  const totalFaculties = facultyList.length;
  const totalCohorts = cohorts.length;

  // View students in class
  async function openStudentsModal(cls: Row) {
    setViewingClass(cls);
    setLoadingStudents(true);
    setClassStudents([]);
    try {
      const maLop = Number(value(cls, "MaLop"));
      const result = await workflowRequest<unknown>(`/admin/accounts/classes/${maLop}/students`);
      setClassStudents(Array.isArray(result) ? (result as Row[]) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách sinh viên của lớp.");
    } finally {
      setLoadingStudents(false);
    }
  }

  // Open Edit Modal
  function openEditModal(cls: Row) {
    setEditingClass(cls);
    setEditTenLop(text(cls, "TenLop") !== "—" ? text(cls, "TenLop") : "");
    setEditMaKhoa(Number(value(cls, "MaKhoa")) || "");
    setEditKhoaHoc(text(cls, "KhoaHoc") !== "—" ? text(cls, "KhoaHoc") : "");
  }

  // Submit Create Class
  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTenLop.trim() || !newMaKhoa) {
      setError("Vui lòng điền đầy đủ Tên lớp và chọn Khoa.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await workflowRequest("/admin/accounts/classes", {
        method: "POST",
        body: {
          tenLop: newTenLop.trim(),
          maKhoa: Number(newMaKhoa),
          khoaHoc: newKhoaHoc.trim() || undefined,
        },
      });
      setNotice(`Đã thêm thành công lớp học "${newTenLop.trim()}".`);
      setShowAddModal(false);
      setNewTenLop("");
      setNewMaKhoa("");
      setNewKhoaHoc("");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được lớp học.");
    } finally {
      setBusy(false);
    }
  }

  // Submit Edit Class
  async function handleUpdateClass() {
    if (!editingClass) return;
    const maLop = Number(value(editingClass, "MaLop"));
    if (!editTenLop.trim() || !editMaKhoa) {
      setError("Vui lòng nhập đầy đủ Tên lớp và chọn Khoa.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await workflowRequest(`/admin/accounts/classes/${maLop}`, {
        method: "PATCH",
        body: {
          tenLop: editTenLop.trim(),
          maKhoa: Number(editMaKhoa),
          khoaHoc: editKhoaHoc.trim() || undefined,
        },
      });
      setNotice(`Đã cập nhật lớp học "${editTenLop.trim()}".`);
      setEditingClass(null);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cập nhật được lớp học.");
    } finally {
      setBusy(false);
    }
  }

  // Submit Delete Class
  async function handleDeleteClass() {
    if (!deletingClass) return;
    const maLop = Number(value(deletingClass, "MaLop"));
    const tenLop = text(deletingClass, "TenLop");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await workflowRequest(`/admin/accounts/classes/${maLop}`, {
        method: "DELETE",
      });
      setNotice(`Đã xóa thành công lớp "${tenLop}".`);
      setDeletingClass(null);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa lớp học.");
    } finally {
      setBusy(false);
    }
  }

  // Export CSV
  const exportCSV = () => {
    const headers = ["Mã lớp", "Tên lớp", "Khoa / Đơn vị", "Khóa học", "Sĩ số sinh viên"];
    const rowsData = filteredClasses.map((c) => [
      text(c, "MaLop"),
      text(c, "TenLop"),
      text(c, "TenKhoa"),
      text(c, "KhoaHoc"),
      text(c, "SiSo"),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rowsData.map((e) => e.map((cell) => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Danh_sach_lop_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={s.usersPanelWrapper}>
      {/* Alert Messages */}
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

      {/* Header Row: Title & Action Button */}
      <div className={s.usersHeaderRow}>
        <div>
          <h1 className={s.usersPageTitle}>Quản lý lớp</h1>
          <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#64748b" }}>
            Quản lý danh sách các lớp học, phân khoa trực thuộc, khóa đào tạo và theo dõi sĩ số sinh viên từ CSDL.
          </p>
        </div>
        <button className={s.addAccountBtn} onClick={() => setShowAddModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tạo lớp mới
        </button>
      </div>

      {/* KPI Cards */}
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Tổng số lớp học</span>
            <div className={`${s.kpiIconWrap} ${s.kpiBlue}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalClasses}</div>
          <div className={s.kpiBadgeBlue}>{totalClasses} lớp đang hoạt động</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Tổng sinh viên</span>
            <div className={`${s.kpiIconWrap} ${s.kpiGreen}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalStudents}</div>
          <div className={s.kpiBadgeGreen}>Đã biên chế theo lớp</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Khoa / Đơn vị</span>
            <div className={`${s.kpiIconWrap} ${s.kpiPurple}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalFaculties}</div>
          <div className={s.kpiBadgePurple}>Khoa chuyên ngành</div>
        </div>

        <div className={s.kpiCard}>
          <div className={s.kpiTop}>
            <span className={s.kpiLabel}>Khóa đào tạo</span>
            <div className={`${s.kpiIconWrap} ${s.kpiAmber}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className={s.kpiValue}>{totalCohorts}</div>
          <div className={s.kpiBadgeAmber}>Niên khóa áp dụng</div>
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
            placeholder="Tìm theo tên lớp, khoa, khóa học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={s.filterDropdown}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}>
            <option value="all">Tất cả các khoa</option>
            {facultyList.map((f, i) => (
              <option key={`fac-filter-${i}`} value={text(f, "TenKhoa")}>
                {text(f, "TenKhoa")}
              </option>
            ))}
          </select>
        </div>

        <div className={s.filterDropdown}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <select value={filterCohort} onChange={(e) => setFilterCohort(e.target.value)}>
            <option value="all">Tất cả khóa học</option>
            {cohorts.map((kh, i) => (
              <option key={`coh-filter-${i}`} value={kh}>
                Khóa {kh}
              </option>
            ))}
          </select>
        </div>

        <button className={s.exportBtn} onClick={() => void loadData()} title="Làm mới">
          🔄 Làm mới
        </button>

        <button className={s.exportBtn} onClick={exportCSV}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Xuất dữ liệu
        </button>
      </div>

      {/* Main Classes Table */}
      <div className={s.tableCard}>
        <table className={s.modernTable}>
          <thead>
            <tr>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "12px", width: "90px" }}>MÃ LỚP</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "12px" }}>TÊN LỚP</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "12px" }}>KHOA / ĐƠN VỊ</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "12px" }}>KHÓA HỌC</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "12px" }}>SĨ SỐ SINH VIÊN</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "12px" }}>TRẠNG THÁI</th>
              <th style={{ fontWeight: 700, color: "#0f172a", fontSize: "12px", textAlign: "right" }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  Đang tải danh sách lớp học…
                </td>
              </tr>
            ) : filteredClasses.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  Không tìm thấy lớp học phù hợp.
                </td>
              </tr>
            ) : (
              filteredClasses.map((cls, index) => {
                const id = Number(value(cls, "MaLop"));
                const tenLop = text(cls, "TenLop");
                const tenKhoa = text(cls, "TenKhoa");
                const khoaHoc = text(cls, "KhoaHoc");
                const siSo = Number(value(cls, "SiSo")) || 0;

                return (
                  <tr key={`class-row-${id}-${index}`}>
                    <td>
                      <span style={{ fontWeight: 600, color: "#2563eb", background: "#eff6ff", padding: "4px 8px", borderRadius: "6px" }}>
                        #{id}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                        {tenLop}
                      </span>
                    </td>
                    <td>
                      <span className={s.unitText} style={{ color: "#334155" }}>
                        {tenKhoa}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#475569" }}>{khoaHoc}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => openStudentsModal(cls)}
                        title="Bấm để xem danh sách sinh viên lớp này"
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          color: "#166534",
                          borderRadius: "20px",
                          padding: "3px 12px",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        👥 {siSo} sinh viên
                      </button>
                    </td>
                    <td>
                      <span style={{ display: "inline-block", background: "#f0fdf4", color: "#16a34a", padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>
                        ● Đang hoạt động
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className={s.rowActions}>
                        <button
                          title="Xem danh sách sinh viên"
                          className={s.rowActionBtn}
                          onClick={() => openStudentsModal(cls)}
                        >
                          👥 Xem SV
                        </button>
                        <button
                          title="Chỉnh sửa lớp học"
                          className={s.rowActionBtn}
                          onClick={() => openEditModal(cls)}
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          title="Xóa lớp học"
                          className={`${s.rowActionBtn} ${s.actionLock}`}
                          onClick={() => setDeletingClass(cls)}
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

      {/* Modal: Tạo lớp học mới */}
      {showAddModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <div className={s.modalHeader}>
              <h3>Thêm lớp học mới</h3>
              <button className={s.modalClose} onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateClass} className={s.modalForm}>
              <label>
                <span>
                  Tên lớp <span style={{ color: "#ef4444" }}>*</span>
                </span>
                <input
                  value={newTenLop}
                  onChange={(e) => setNewTenLop(e.target.value)}
                  placeholder="Ví dụ: DHKTPM24B"
                  required
                  maxLength={100}
                  className={s.cleanInput}
                />
              </label>

              <label>
                <span>
                  Khoa / Đơn vị trực thuộc <span style={{ color: "#ef4444" }}>*</span>
                </span>
                <select
                  value={newMaKhoa}
                  onChange={(e) => setNewMaKhoa(Number(e.target.value) || "")}
                  required
                  className={s.cleanInput}
                >
                  <option value="">-- Chọn Khoa --</option>
                  {facultyList.map((f, i) => (
                    <option key={`new-fac-${i}`} value={Number(value(f, "MaKhoa"))}>
                      {text(f, "TenKhoa")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Khóa học</span>
                <input
                  value={newKhoaHoc}
                  onChange={(e) => setNewKhoaHoc(e.target.value)}
                  placeholder="Ví dụ: 2024-2028"
                  maxLength={50}
                  className={s.cleanInput}
                />
              </label>

              <div className={s.modalFoot}>
                <button
                  type="button"
                  className={s.exportBtn}
                  onClick={() => setShowAddModal(false)}
                  disabled={busy}
                >
                  Hủy
                </button>
                <button type="submit" className={s.addAccountBtn} disabled={busy}>
                  {busy ? "Đang lưu…" : "Tạo lớp học"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa lớp học */}
      {editingClass && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <div className={s.modalHeader}>
              <h3>Chỉnh sửa lớp học</h3>
              <button className={s.modalClose} onClick={() => setEditingClass(null)}>
                ✕
              </button>
            </div>
            <div className={s.modalForm}>
              <label>
                <span>
                  Tên lớp <span style={{ color: "#ef4444" }}>*</span>
                </span>
                <input
                  value={editTenLop}
                  onChange={(e) => setEditTenLop(e.target.value)}
                  required
                  maxLength={100}
                  className={s.cleanInput}
                />
              </label>

              <label>
                <span>
                  Khoa / Đơn vị <span style={{ color: "#ef4444" }}>*</span>
                </span>
                <select
                  value={editMaKhoa}
                  onChange={(e) => setEditMaKhoa(Number(e.target.value) || "")}
                  required
                  className={s.cleanInput}
                >
                  <option value="">-- Chọn Khoa --</option>
                  {facultyList.map((f, i) => (
                    <option key={`edit-fac-${i}`} value={Number(value(f, "MaKhoa"))}>
                      {text(f, "TenKhoa")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Khóa học</span>
                <input
                  value={editKhoaHoc}
                  onChange={(e) => setEditKhoaHoc(e.target.value)}
                  placeholder="Ví dụ: 2023-2027"
                  maxLength={50}
                  className={s.cleanInput}
                />
              </label>

              <div className={s.modalFoot}>
                <button
                  type="button"
                  className={s.exportBtn}
                  onClick={() => setEditingClass(null)}
                  disabled={busy}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className={s.addAccountBtn}
                  onClick={handleUpdateClass}
                  disabled={busy}
                >
                  {busy ? "Đang lưu…" : "Cập nhật"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa lớp */}
      {deletingClass && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <div className={s.modalHeader}>
              <h3>Xác nhận xóa lớp học</h3>
              <button className={s.modalClose} onClick={() => setDeletingClass(null)}>
                ✕
              </button>
            </div>
            <div style={{ padding: "16px 0", fontSize: "14px", color: "#334155", lineHeight: "1.6" }}>
              <p>
                Bạn có chắc chắn muốn xóa lớp học{" "}
                <strong>{text(deletingClass, "TenLop")}</strong> thuộc khoa{" "}
                <strong>{text(deletingClass, "TenKhoa")}</strong> không?
              </p>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#64748b" }}>
                Lưu ý: Chỉ có thể xóa các lớp chưa có sinh viên biên chế và không có phân công hỗ trợ.
              </p>
            </div>
            <div className={s.modalFoot}>
              <button
                type="button"
                className={s.exportBtn}
                onClick={() => setDeletingClass(null)}
                disabled={busy}
              >
                Hủy
              </button>
              <button
                type="button"
                className={`${s.addAccountBtn} ${s.actionLock}`}
                style={{ background: "#dc2626" }}
                onClick={handleDeleteClass}
                disabled={busy}
              >
                {busy ? "Đang xóa…" : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Danh sách sinh viên thuộc lớp */}
      {viewingClass && (
        <div className={s.modalOverlay}>
          <div className={`${s.modalBox} ${s.modalBoxLarge}`}>
            <div className={s.modalHeader}>
              <div>
                <h3 style={{ margin: 0 }}>
                  Sinh viên lớp {text(viewingClass, "TenLop")}
                </h3>
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                  Khoa: {text(viewingClass, "TenKhoa")} · Khóa học: {text(viewingClass, "KhoaHoc")}
                </span>
              </div>
              <button className={s.modalClose} onClick={() => setViewingClass(null)}>
                ✕
              </button>
            </div>
            <div style={{ maxHeight: "420px", overflowY: "auto", margin: "16px 0" }}>
              <table className={s.modernTable}>
                <thead>
                  <tr>
                    <th style={{ fontWeight: 700, color: "#0f172a" }}>MSSV</th>
                    <th style={{ fontWeight: 700, color: "#0f172a" }}>HỌ VÀ TÊN</th>
                    <th style={{ fontWeight: 700, color: "#0f172a" }}>EMAIL</th>
                    <th style={{ fontWeight: 700, color: "#0f172a" }}>SỐ ĐIỆN THOẠI</th>
                    <th style={{ fontWeight: 700, color: "#0f172a" }}>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                        Đang tải danh sách sinh viên…
                      </td>
                    </tr>
                  ) : classStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                        Chưa có sinh viên nào trong lớp này.
                      </td>
                    </tr>
                  ) : (
                    classStudents.map((st, i) => (
                      <tr key={`cls-st-${i}`}>
                        <td>
                          <span style={{ color: "#334155" }}>{text(st, "MSSV")}</span>
                        </td>
                        <td>
                          <span style={{ color: "#0f172a", fontWeight: 500 }}>{text(st, "HoTen")}</span>
                        </td>
                        <td>
                          <span className={s.emailCell}>{text(st, "Email")}</span>
                        </td>
                        <td>
                          <span style={{ color: "#475569" }}>{text(st, "SDT")}</span>
                        </td>
                        <td>
                          <span style={{ color: "#16a34a", fontSize: "12.5px", fontWeight: 600 }}>
                            {text(st, "TrangThai")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className={s.modalFoot}>
              <button type="button" className={s.exportBtn} onClick={() => setViewingClass(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
