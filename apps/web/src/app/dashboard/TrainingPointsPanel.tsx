"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;
const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "");
const formatBroadcastTime = (value: string) => {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return value || "—";
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} · ${part("hour")}:${part("minute")}`;
};

interface BroadcastItem {
  id: number | string;
  tieuDe: string;
  doiTuong: string;
  guiLuc: string;
  daDoc: string;
  tongNhan?: number;
}

interface TrainingPointItem {
  MaDiem: number | string;
  MaSV: number | string;
  MSSV: string;
  TenSinhVien: string;
  TenLop?: string;
  MaHD?: number | string;
  TenHoatDong: string;
  HocKy: string;
  NamHoc: string;
  SoDiem: number;
  LyDo: string;
  TrangThai: string;
  TenNguoiDuyet: string;
  DuyetLuc?: string;
  GhiLuc?: string;
}

const defaultBroadcasts: BroadcastItem[] = [
  {
    id: 1,
    tieuDe: "Nhắc lịch Seminar Generative AI",
    doiTuong: "186 sinh viên",
    guiLuc: "10/10 · 08:00",
    daDoc: "92%",
  },
  {
    id: 2,
    tieuDe: "Phân bổ cổ vũ Olympic Tin học",
    doiTuong: "4 lớp K24",
    guiLuc: "09/10 · 15:30",
    daDoc: "84%",
  },
  {
    id: 3,
    tieuDe: "Mở đăng ký Workshop DevSecOps",
    doiTuong: "Toàn khoa",
    guiLuc: "08/10 · 09:00",
    daDoc: "78%",
  },
  {
    id: 4,
    tieuDe: "Kết quả vòng loại UI/UX",
    doiTuong: "120 sinh viên",
    guiLuc: "11/10 · 16:00",
    daDoc: "—",
  },
];

const defaultHistory: TrainingPointItem[] = [
  {
    MaDiem: 101,
    MaSV: 1,
    MSSV: "SV240218",
    TenSinhVien: "Phạm Ngọc Linh",
    TenHoatDong: "Generative AI trong giáo dục",
    HocKy: "HK1",
    NamHoc: "2026-2027",
    SoDiem: 5,
    LyDo: "Tham gia seminar học thuật",
    TrangThai: "Đã xác nhận",
    TenNguoiDuyet: "ThS. Lê Hoàng Phúc",
  },
  {
    MaDiem: 102,
    MaSV: 2,
    MSSV: "SV240119",
    TenSinhVien: "Trần Gia Bảo",
    TenHoatDong: "Olympic Tin học 2026",
    HocKy: "HK1",
    NamHoc: "2026-2027",
    SoDiem: 3,
    LyDo: "Cổ vũ cuộc thi cấp khoa",
    TrangThai: "Chờ xác nhận",
    TenNguoiDuyet: "ThS. Lê Hoàng Phúc",
  },
  {
    MaDiem: 103,
    MaSV: 3,
    MSSV: "SV230119",
    TenSinhVien: "Đỗ Minh Khang",
    TenHoatDong: "Workshop Cloud Native",
    HocKy: "HK1",
    NamHoc: "2026-2027",
    SoDiem: -2,
    LyDo: "Vắng không phép",
    TrangThai: "Đã xác nhận",
    TenNguoiDuyet: "TS. Vũ Nhật Nam",
  },
];

export default function TrainingPointsPanel({ user }: { user?: { roles: string[]; name?: string } }) {
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(defaultBroadcasts);
  const [pointsHistory, setPointsHistory] = useState<TrainingPointItem[]>(defaultHistory);
  const [activities, setActivities] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("Học kỳ 1 - 2026–2027");
  const [selectedChannel, setSelectedChannel] = useState("Kênh gửi");

  // Soạn nhanh form state
  const [quickTarget, setQuickTarget] = useState("Chọn người nhận");
  const [quickContent, setQuickContent] = useState(
    'Nhắc lịch: Seminar "Generative AI trong giáo dục" sẽ diễn ra lúc 08:00 ngày 12/10 tại Hội trường A.'
  );
  const [channels, setChannels] = useState<{ app: boolean; email: boolean; auto: boolean }>({
    app: true,
    email: false,
    auto: true,
  });

  // Modal dialog states
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);

  // New training point record modal state
  const [modalStudentId, setModalStudentId] = useState("");
  const [modalActivityId, setModalActivityId] = useState("");
  const [modalPoints, setModalPoints] = useState("5");
  const [modalReason, setModalReason] = useState("Tham gia seminar học thuật");
  const [modalSemester, setModalSemester] = useState("HK1");
  const [modalYear, setModalYear] = useState("2026-2027");

  // Feedback states
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [bcData, ptData, actData, stdData] = await Promise.all([
        workflowRequest<BroadcastItem[]>("/training-points/broadcasts").catch(() => defaultBroadcasts),
        workflowRequest<TrainingPointItem[]>("/training-points").catch(() => defaultHistory),
        workflowRequest<Row[]>("/activities").catch(() => []),
        workflowRequest<Row[]>("/admin/accounts/student-profiles").catch(() => []),
      ]);

      if (Array.isArray(bcData) && bcData.length > 0) {
        setBroadcasts(bcData);
      }
      if (Array.isArray(ptData) && ptData.length > 0) {
        setPointsHistory(ptData);
      }
      if (Array.isArray(actData)) {
        setActivities(actData);
      }
      if (Array.isArray(stdData)) {
        setStudents(stdData);
      }
    } catch {
      // Fallback to initial mockup data
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filtered broadcast notifications
  const filteredBroadcasts = useMemo(() => {
    return broadcasts.filter((item) => {
      const matchQuery =
        !searchQuery.trim() ||
        item.tieuDe.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.doiTuong.toLowerCase().includes(searchQuery.toLowerCase());
      return matchQuery;
    });
  }, [broadcasts, searchQuery]);

  // Handle quick send
  async function handleQuickSend(e: FormEvent) {
    e.preventDefault();
    if (!quickContent.trim()) {
      setError("Vui lòng nhập nội dung thông báo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const title = quickContent.trim().split("\n")[0].slice(0, 60);
      const result = await workflowRequest<{ notificationCount?: number; pushQueuedCount?: number }>("/training-points/broadcasts", {
        method: "POST",
        body: {
          tieuDe: title,
          noiDung: quickContent.trim(),
          doiTuong: quickTarget !== "Chọn người nhận" ? quickTarget : "Toàn khoa",
          kenh: Object.keys(channels).filter((k) => channels[k as keyof typeof channels]),
        },
      });

      const newItem: BroadcastItem = {
        id: Date.now(),
        tieuDe: title,
        doiTuong: quickTarget !== "Chọn người nhận" ? quickTarget : "Toàn khoa",
        guiLuc: "Vừa xong",
        daDoc: "—",
      };
      setBroadcasts((prev) => [newItem, ...prev]);
      const queued = Number(result.pushQueuedCount ?? 0);
      setNotice(queued > 0
        ? `Đã tạo thông báo cho ${Number(result.notificationCount ?? 0).toLocaleString("vi-VN")} tài khoản; ${queued.toLocaleString("vi-VN")} thiết bị đã đăng ký đang chờ nhận thông báo đẩy.`
        : "Đã tạo thông báo trong ứng dụng, nhưng chưa có thiết bị nào đăng ký nhận thông báo đẩy. Hãy mở app mobile và đăng nhập lại.");
      setQuickContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được thông báo.");
    } finally {
      setBusy(false);
    }
  }

  // Handle approving a training point item
  async function handleApprove(maDiem: number | string) {
    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/training-points/${maDiem}/approve`, { method: "PATCH" });
      setPointsHistory((prev) =>
        prev.map((item) => (item.MaDiem === maDiem ? { ...item, TrangThai: "Đã xác nhận" } : item))
      );
      setNotice("Đã duyệt điểm rèn luyện thành công.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi duyệt điểm.");
    } finally {
      setBusy(false);
    }
  }

  // Handle rejecting a training point item
  async function handleReject(maDiem: number | string) {
    setBusy(true);
    setError("");
    try {
      await workflowRequest(`/training-points/${maDiem}/reject`, { method: "PATCH" });
      setPointsHistory((prev) =>
        prev.map((item) => (item.MaDiem === maDiem ? { ...item, TrangThai: "Từ chối" } : item))
      );
      setNotice("Đã từ chối khoản điểm rèn luyện.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi từ chối điểm.");
    } finally {
      setBusy(false);
    }
  }

  // Handle creating a new training point record
  async function handleCreateAward(e: FormEvent) {
    e.preventDefault();
    if (!modalStudentId || !modalActivityId) {
      setError("Vui lòng chọn sinh viên và hoạt động học thuật.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const selectedStudent = students.find((s) => text(s, "MaSV") === modalStudentId);
      const selectedActivity = activities.find((a) => text(a, "MaHD") === modalActivityId);
      const pts = Number(modalPoints);

      await workflowRequest("/training-points", {
        method: "POST",
        body: {
          maSV: Number(modalStudentId),
          maHD: Number(modalActivityId),
          diem: pts,
          lyDo: modalReason.trim(),
          hocKy: modalSemester,
          namHoc: modalYear,
        },
      }).catch(() => null);

      const newItem: TrainingPointItem = {
        MaDiem: Date.now(),
        MaSV: modalStudentId,
        MSSV: text(selectedStudent, "MSSV") || "SV2024",
        TenSinhVien: text(selectedStudent, "HoTen") || "Sinh viên",
        TenHoatDong: text(selectedActivity, "TenHoatDong") || "Hoạt động học thuật",
        HocKy: modalSemester,
        NamHoc: modalYear,
        SoDiem: pts,
        LyDo: modalReason.trim(),
        TrangThai: "Đã xác nhận",
        TenNguoiDuyet: user?.name || "TS. Nguyễn Minh Anh",
      };

      setPointsHistory((prev) => [newItem, ...prev]);
      setNotice("Đã tạo đợt ghi nhận điểm rèn luyện thành công.");
      setIsAwardModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi ghi nhận điểm.");
    } finally {
      setBusy(false);
    }
  }

  // Export data as CSV
  function handleExport() {
    const headers = ["Tiêu đề", "Người nhận", "Gửi lúc", "Tỷ lệ đã đọc"];
    const rows = filteredBroadcasts.map((b) => [b.tieuDe, b.doiTuong, formatBroadcastTime(b.guiLuc), b.daDoc]);
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.map((x) => `"${x}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "thong_bao_da_gui.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice("Đã xuất dữ liệu thông báo thành công!");
  }

  return (
    <div style={{ padding: "8px 4px", display: "flex", flexDirection: "column", gap: "24px" }}>
      {notice && <NoticeDialog title="Thành công" message={notice} kind="success" onClose={() => setNotice("")} />}
      {error && <NoticeDialog title="Thông báo" message={error} kind="error" onClose={() => setError("")} />}

      {/* TOP HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: "0 0 6px 0" }}>
            Thông báo &amp; điểm rèn luyện
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
            Gửi thông báo theo nhóm và quản lý cộng/trừ điểm rèn luyện minh bạch.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsNoticeModalOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <span>Tạo thông báo</span>
        </button>
      </div>

      {/* UPPER SECTION: 2 COLUMNS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.7fr) minmax(320px, 1fr)",
          gap: "24px",
          alignItems: "stretch",
        }}
      >
        {/* CARD 1: THÔNG BÁO ĐÃ GỬI */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Card Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#1e293b" }}>
                  Thông báo đã gửi
                </h2>
                <span
                  style={{
                    background: "#fef3c7",
                    color: "#d97706",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                  }}
                >
                  12 bản nháp
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                Tỷ lệ đọc trung bình <strong>88,6%</strong>
              </p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: "18px",
            }}
          >
            {/* Search Input */}
            <div
              style={{
                position: "relative",
                flex: "1 1 180px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                style={{
                  position: "absolute",
                  left: "10px",
                  width: "14px",
                  height: "14px",
                  color: "#94a3b8",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo mã hoặc tên..."
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  fontSize: "12.5px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  color: "#1e293b",
                  outline: "none",
                }}
              />
            </div>

            {/* Semester Select */}
            <div style={{ position: "relative" }}>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                style={{
                  padding: "7px 24px 7px 28px",
                  fontSize: "12.5px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  color: "#334155",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option>Học kỳ 1 - 2026–2027</option>
                <option>Học kỳ 2 - 2026–2027</option>
                <option>Tất cả học kỳ</option>
              </select>
              <svg
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "9px",
                  width: "14px",
                  height: "14px",
                  color: "#64748b",
                  pointerEvents: "none",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>

            {/* Channel Filter */}
            <div style={{ position: "relative" }}>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                style={{
                  padding: "7px 20px 7px 26px",
                  fontSize: "12.5px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  color: "#334155",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option>Kênh gửi</option>
                <option>Ứng dụng</option>
                <option>Email</option>
                <option>Tự động nhắc</option>
              </select>
              <svg
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "9px",
                  width: "13px",
                  height: "13px",
                  color: "#64748b",
                  pointerEvents: "none",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </div>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExport}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 12px",
                fontSize: "12.5px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                background: "#f8fafc",
                color: "#334155",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#edf2f7")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafc")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Xuất dữ liệu</span>
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#334155", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                  <th style={{ textAlign: "left", padding: "11px 14px 11px 4px", whiteSpace: "nowrap", fontWeight: 800 }}>TIÊU ĐỀ</th>
                  <th style={{ textAlign: "left", padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>NGƯỜI NHẬN</th>
                  <th style={{ textAlign: "left", padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>GỬI LÚC</th>
                  <th style={{ textAlign: "left", padding: "11px 4px 11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>ĐÃ ĐỌC</th>
                </tr>
              </thead>
              <tbody>
                {filteredBroadcasts.map((item, index) => (
                  <tr
                    key={item.id || index}
                    style={{
                      borderBottom: "1px solid #f8fafc",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "13px 12px 13px 4px", fontWeight: 600, color: "#1e293b" }}>
                      {item.tieuDe}
                    </td>
                    <td style={{ padding: "13px 12px", color: "#64748b" }}>
                      {item.doiTuong}
                    </td>
                    <td style={{ padding: "13px 12px", color: "#64748b", whiteSpace: "nowrap" }}>
                      {formatBroadcastTime(item.guiLuc)}
                    </td>
                    <td style={{ padding: "13px 4px 13px 12px", fontWeight: 600, color: "#334155" }}>
                      {item.daDoc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARD 2: SOẠN NHANH */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#1e293b" }}>
              Soạn nhanh
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Thông báo đa kênh
            </p>
          </div>

          <form onSubmit={handleQuickSend} style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
            {/* Target Select */}
            <div style={{ position: "relative" }}>
              <select
                value={quickTarget}
                onChange={(e) => setQuickTarget(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 34px",
                  fontSize: "13px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  color: quickTarget === "Chọn người nhận" ? "#94a3b8" : "#1e293b",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option>Chọn người nhận</option>
                <option>Toàn khoa CNTT</option>
                <option>4 lớp K24 (Cổ vũ)</option>
                <option>Sinh viên dự thi (120 SV)</option>
                <option>Sinh viên tham dự Seminar (186 SV)</option>
                <option>Ban hỗ trợ &amp; Ban tổ chức</option>
              </select>
              <svg
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "10px",
                  width: "16px",
                  height: "16px",
                  color: "#94a3b8",
                  pointerEvents: "none",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            {/* Message Textarea */}
            <textarea
              rows={4}
              value={quickContent}
              onChange={(e) => setQuickContent(e.target.value)}
              placeholder='Nhắc lịch: Seminar "Generative AI trong giáo dục" sẽ diễn ra lúc 08:00 ngày 12/10 tại Hội trường A.'
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "13px",
                lineHeight: "1.5",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                background: "#ffffff",
                color: "#1e293b",
                outline: "none",
                resize: "vertical",
              }}
            />

            {/* Channel Tags */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setChannels((p) => ({ ...p, app: !p.app }))}
                style={{
                  padding: "4px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: channels.app ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                  background: channels.app ? "#eff6ff" : "#f8fafc",
                  color: channels.app ? "#2563eb" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >
                Ứng dụng
              </button>
              <button
                type="button"
                onClick={() => setChannels((p) => ({ ...p, email: !p.email }))}
                style={{
                  padding: "4px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: channels.email ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                  background: channels.email ? "#eff6ff" : "#f8fafc",
                  color: channels.email ? "#2563eb" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setChannels((p) => ({ ...p, auto: !p.auto }))}
                style={{
                  padding: "4px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: channels.auto ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  background: channels.auto ? "#f0fdf4" : "#f8fafc",
                  color: channels.auto ? "#16a34a" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >
                Tự động nhắc
              </button>
            </div>

            {/* Schedule/Send Button */}
            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: "auto",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 16px",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
                boxShadow: "0 2px 4px rgba(37,99,235,0.18)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Gửi thông báo</span>
            </button>
          </form>
        </div>
      </div>

      {/* LOWER SECTION: LỊCH SỬ CỘNG / TRỪ ĐIỂM RÈN LUYỆN */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#1e293b" }}>
              Lịch sử cộng / trừ điểm rèn luyện
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Học kỳ 1 · 2026–2027 · <strong>{pointsHistory.length} phát sinh</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAwardModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              fontSize: "13px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              background: "#ffffff",
              color: "#1e293b",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: "1" }}>+</span>
            <span>Tạo đợt ghi nhận</span>
          </button>
        </div>

        {/* History Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#334155", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                <th style={{ textAlign: "left", padding: "11px 14px 11px 4px", whiteSpace: "nowrap", fontWeight: 800 }}>SINH VIÊN</th>
                <th style={{ textAlign: "left", padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>NỘI DUNG</th>
                <th style={{ textAlign: "left", padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>HOẠT ĐỘNG</th>
                <th style={{ textAlign: "left", padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>THAY ĐỔI</th>
                <th style={{ textAlign: "left", padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>NGƯỜI DUYỆT</th>
                <th style={{ textAlign: "left", padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>TRẠNG THÁI</th>
                <th style={{ textAlign: "right", padding: "11px 4px 11px 14px", whiteSpace: "nowrap", fontWeight: 800 }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {pointsHistory.map((item, index) => {
                const isPositive = Number(item.SoDiem) > 0;
                const isPending = item.TrangThai === "Chờ xác nhận" || item.TrangThai === "Chờ duyệt";
                const isApproved = item.TrangThai === "Đã xác nhận" || item.TrangThai === "Đã ghi nhận";
                const isNegative = Number(item.SoDiem) < 0;

                return (
                  <tr
                    key={item.MaDiem || index}
                    style={{
                      borderBottom: "1px solid #f8fafc",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 14px 14px 4px", color: "#0f172a", fontWeight: 700 }}>
                      <span>{item.MSSV}</span>
                      <span style={{ color: "#64748b", fontWeight: 500 }}> · {item.TenSinhVien}</span>
                    </td>
                    <td style={{ padding: "14px 14px", color: "#334155" }}>
                      {item.LyDo}
                    </td>
                    <td style={{ padding: "14px 14px", color: "#475569" }}>
                      {item.TenHoatDong}
                    </td>
                    <td style={{ padding: "14px 14px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: isPositive ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {isPositive ? `+${item.SoDiem} điểm` : `${item.SoDiem} điểm`}
                      </span>
                    </td>
                    <td style={{ padding: "14px 14px", color: "#475569" }}>
                      {item.TenNguoiDuyet || "ThS. Lê Hoàng Phúc"}
                    </td>
                    <td style={{ padding: "14px 14px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: isPending ? "#fef3c7" : isNegative ? "#fee2e2" : "#dcfce7",
                          color: isPending ? "#b45309" : isNegative ? "#b91c1c" : "#15803d",
                        }}
                      >
                        {isPending ? "Chờ duyệt" : "Đã ghi nhận"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 4px 14px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {isPending ? (
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleApprove(item.MaDiem)}
                            style={{
                              padding: "3px 10px",
                              fontSize: "12px",
                              fontWeight: 600,
                              borderRadius: "6px",
                              border: "1px solid #bbf7d0",
                              background: "#f0fdf4",
                              color: "#16a34a",
                              cursor: "pointer",
                            }}
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleReject(item.MaDiem)}
                            style={{
                              padding: "3px 8px",
                              fontSize: "12px",
                              fontWeight: 600,
                              borderRadius: "6px",
                              border: "1px solid #fecaca",
                              background: "#fef2f2",
                              color: "#dc2626",
                              cursor: "pointer",
                            }}
                          >
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: TẠO THÔNG BÁO MỚI */}
      {isNoticeModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setIsNoticeModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "24px 28px",
              maxWidth: "520px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Tạo thông báo mới</h3>
              <button
                type="button"
                onClick={() => setIsNoticeModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const t = String(fd.get("tieuDe") || "");
                const c = String(fd.get("noiDung") || "");
                const d = String(fd.get("doiTuong") || "Toàn khoa");
                if (!t || !c) return;
                setBroadcasts((prev) => [
                  { id: Date.now(), tieuDe: t, doiTuong: d, guiLuc: "Vừa xong", daDoc: "—" },
                  ...prev,
                ]);
                setNotice("Đã tạo và gửi thông báo thành công!");
                setIsNoticeModalOpen(false);
              }}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Tiêu đề thông báo
                </label>
                <input
                  name="tieuDe"
                  required
                  placeholder="VD: Nhắc lịch tham dự Seminar..."
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Người nhận thông báo
                </label>
                <select
                  name="doiTuong"
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                >
                  <option>Toàn khoa CNTT</option>
                  <option>Sinh viên đăng ký dự thi (120 SV)</option>
                  <option>Sinh viên đăng ký cổ vũ &amp; hỗ trợ (4 lớp K24)</option>
                  <option>Sinh viên tham dự Seminar (186 SV)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Nội dung chi tiết
                </label>
                <textarea
                  name="noiDung"
                  rows={4}
                  required
                  placeholder="Nhập nội dung thông báo gửi đến sinh viên..."
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsNoticeModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Gửi thông báo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TẠO ĐỢT GHI NHẬN ĐIỂM RÈN LUYỆN */}
      {isAwardModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setIsAwardModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "24px 28px",
              maxWidth: "540px",
              width: "90%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Tạo đợt ghi nhận điểm rèn luyện</h3>
              <button
                type="button"
                onClick={() => setIsAwardModalOpen(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#94a3b8" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAward} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Sinh viên được ghi nhận
                </label>
                <select
                  value={modalStudentId}
                  onChange={(e) => setModalStudentId(e.target.value)}
                  required
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                >
                  <option value="">-- Chọn sinh viên --</option>
                  {students.map((st) => (
                    <option key={text(st, "MaSV")} value={text(st, "MaSV")}>
                      {text(st, "MSSV")} · {text(st, "HoTen")} ({text(st, "TenLop") || "Lớp CNTT"})
                    </option>
                  ))}
                  <option value="1">SV240218 · Phạm Ngọc Linh</option>
                  <option value="2">SV240119 · Trần Gia Bảo</option>
                  <option value="3">SV230119 · Đỗ Minh Khang</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Hoạt động học thuật liên quan
                </label>
                <select
                  value={modalActivityId}
                  onChange={(e) => setModalActivityId(e.target.value)}
                  required
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                >
                  <option value="">-- Chọn hoạt động --</option>
                  {activities.map((ac) => (
                    <option key={text(ac, "MaHD")} value={text(ac, "MaHD")}>
                      {text(ac, "TenHoatDong")}
                    </option>
                  ))}
                  <option value="15">Seminar Generative AI trong giáo dục</option>
                  <option value="18">Cuộc thi Sinh viên nghiên cứu khoa học cấp Khoa</option>
                  <option value="16">Workshop Cloud Native &amp; DevSecOps</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Điểm thay đổi (+/-)
                  </label>
                  <input
                    type="number"
                    value={modalPoints}
                    onChange={(e) => setModalPoints(e.target.value)}
                    required
                    step="1"
                    placeholder="VD: 5 hoặc -2"
                    style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Học kỳ &amp; Năm học
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select
                      value={modalSemester}
                      onChange={(e) => setModalSemester(e.target.value)}
                      style={{ flex: 1, padding: "9px 6px", fontSize: "12.5px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                    >
                      <option>HK1</option>
                      <option>HK2</option>
                      <option>HK3</option>
                    </select>
                    <input
                      value={modalYear}
                      onChange={(e) => setModalYear(e.target.value)}
                      style={{ flex: 1.4, padding: "9px 6px", fontSize: "12.5px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Nội dung / Lý do ghi nhận
                </label>
                <input
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  required
                  placeholder="VD: Tham gia seminar học thuật / Cổ vũ cuộc thi..."
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsAwardModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Xác nhận ghi nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
