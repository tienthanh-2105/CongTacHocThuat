"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import NoticeDialog from "./NoticeDialog";

type Row = Record<string, unknown>;

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "");

function formatDateVn(value: unknown): string {
  if (!value) return "Chưa cập nhật";
  try {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    if (hours === "00" && mins === "00") {
      return `${day}/${month}/${year}`;
    }
    return `${hours}:${mins} ${day}/${month}/${year}`;
  } catch {
    return String(value);
  }
}

function formatDateOnly(value: unknown): string {
  if (!value) return "Chưa cập nhật";
  try {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

interface StudentParticipationPanelProps {
  section: string;
  user?: AuthUser | null;
  onNavigate?: (id: string) => void;
}

export default function StudentParticipationPanel({
  section,
  user,
  onNavigate,
}: StudentParticipationPanelProps) {
  const [activities, setActivities] = useState<Row[]>([]);
  const [registrations, setRegistrations] = useState<Row[]>([]);
  const [points, setPoints] = useState<{ tongDiem: number; chiTiet: Row[] }>({
    tongDiem: 0,
    chiTiet: [],
  });
  const [profile, setProfile] = useState<Row | null>(null);

  // Tabs & Filters
  const initialTab =
    section === "training-points"
      ? "points"
      : section === "support"
      ? "support"
      : "all";
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "registered">("all");

  // Modals
  const [registeringActivity, setRegisteringActivity] = useState<Row | null>(null);
  const [ticketRegistration, setTicketRegistration] = useState<Row | null>(null);

  // Registration Form States
  const [regMode, setRegMode] = useState<"individual" | "team_create" | "team_join" | "support_cheer">("individual");
  const [teamName, setTeamName] = useState("");
  const [teamMembersInput, setTeamMembersInput] = useState("");
  const [joinTeamId, setJoinTeamId] = useState("");
  const [supportRole, setSupportRole] = useState("Cổ vũ");
  const [supportNote, setSupportNote] = useState("");

  // Feedback states
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  // Check if an activity has an approved detailed organizing plan
  const isActivityApproved = (row: Row): boolean => {
    return Boolean(
      row.MaKeHoach &&
        (row.TrangThaiKeHoach === "Đã duyệt" ||
          row.TrangThaiKeHoach === "Đã công bố" ||
          Boolean(row.CongBoLuc) ||
          row.TrangThai === "Đã công bố")
    );
  };

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [listRes, mineRes, pointsRes, profileRes] = await Promise.allSettled([
        workflowRequest<Row[]>("/activities"),
        workflowRequest<Row[]>("/registrations/my-registrations"),
        workflowRequest<{ tongDiem: number; chiTiet: Row[] }>("/mobile/my-training-points"),
        workflowRequest<Row>("/mobile/profile"),
      ]);

      if (listRes.status === "fulfilled" && Array.isArray(listRes.value)) {
        // Chỉ hiển thị các hoạt động đã có Kế hoạch tổ chức chi tiết được phê duyệt chính thức
        setActivities(listRes.value.filter(isActivityApproved));
      }
      if (mineRes.status === "fulfilled") {
        setRegistrations(mineRes.value);
      }
      if (pointsRes.status === "fulfilled") {
        setPoints(pointsRes.value);
      }
      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [section]);

  // Determine Activity Type
  const getActivityType = (act: Row): "competition" | "seminar" | "support" => {
    if (act.MaCThi || act.TenCuocThi || act.HinhThucThi) return "competition";
    if (act.MaSeminar || act.ChuDe) return "seminar";
    const name = text(act, "TenHoatDong").toLowerCase();
    if (name.includes("cuộc thi") || name.includes("olympic") || name.includes("hackathon")) return "competition";
    if (name.includes("seminar") || name.includes("chuyên đề") || name.includes("workshop") || name.includes("tọa đàm")) return "seminar";
    return "support";
  };

  // Check if student registered for an activity
  const getStudentRegistration = (maHD: unknown) => {
    return registrations.find((r) => Number(r.MaHD) === Number(maHD));
  };

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const type = getActivityType(act);
      if (activeTab === "competitions" && type !== "competition") return false;
      if (activeTab === "seminars" && type !== "seminar") return false;
      if (activeTab === "support" && type !== "support") return false;

      const isReg = Boolean(getStudentRegistration(act.MaHD));
      if (statusFilter === "registered" && !isReg) return false;
      if (statusFilter === "open" && isReg) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = text(act, "TenHoatDong").toLowerCase();
        const desc = text(act, "NoiDung").toLowerCase();
        const venue = text(act, "DiaDiem").toLowerCase();
        if (!title.includes(q) && !desc.includes(q) && !venue.includes(q)) return false;
      }
      return true;
    });
  }, [activities, activeTab, statusFilter, searchQuery, registrations]);

  // Handle Opening Registration Modal
  const openRegisterModal = (act: Row) => {
    setRegisteringActivity(act);
    const type = getActivityType(act);
    if (type === "competition" && act.HinhThucThi === "Theo đội") {
      setRegMode("team_create");
    } else if (section === "support" || type === "support") {
      setRegMode("support_cheer");
    } else {
      setRegMode("individual");
    }
    setTeamName("");
    setTeamMembersInput("");
    setJoinTeamId("");
    setSupportRole("Cổ vũ");
    setSupportNote("");
  };

  // Submit Registration
  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!registeringActivity) return;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const maHD = Number(registeringActivity.MaHD);
      const maCThi = Number(registeringActivity.MaCThi);

      if (regMode === "individual") {
        const type = getActivityType(registeringActivity);
        const hinhThuc = type === "competition" ? "Dự thi" : "Tham gia";
        const res = await workflowRequest<{ message?: string }>("/registrations/individual", {
          method: "POST",
          body: { maHD, hinhThuc },
        });
        setNotice(res.message || "Đăng ký cá nhân thành công!");
      } else if (regMode === "team_create") {
        if (!teamName.trim()) {
          setError("Vui lòng nhập tên đội thi");
          setBusy(false);
          return;
        }
        const memberList = teamMembersInput
          .split(/[\s,;]+/)
          .map((m) => m.trim())
          .filter(Boolean);
        if (memberList.length > 4) {
          setError("Tối đa 4 thành viên khác (đội 2-5 bạn)");
          setBusy(false);
          return;
        }
        const res = await workflowRequest<{ message?: string }>("/registrations/team", {
          method: "POST",
          body: {
            maCThi: maCThi || maHD,
            tenDoi: teamName.trim(),
            thanhVienMSSV: memberList,
          },
        });
        setNotice(res.message || "Đã tạo đội và đăng ký dự thi thành công!");
      } else if (regMode === "team_join") {
        const teamIdNum = Number(joinTeamId);
        if (!teamIdNum || teamIdNum <= 0) {
          setError("Vui lòng nhập mã đội hợp lệ (số nguyên)");
          setBusy(false);
          return;
        }
        const res = await workflowRequest<{ message?: string }>("/registrations/team/join", {
          method: "POST",
          body: { maDoi: teamIdNum },
        });
        setNotice(res.message || "Gia nhập đội thi thành công!");
      } else if (regMode === "support_cheer") {
        const hinhThuc = supportRole === "Cổ vũ" ? "Cổ vũ" : "Hỗ trợ";
        const res = await workflowRequest<{ message?: string }>("/registrations/individual", {
          method: "POST",
          body: { maHD, hinhThuc },
        });
        setNotice(res.message || `Đã đăng ký tham gia ${supportRole.toLowerCase()} thành công!`);
      }

      setRegisteringActivity(null);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng ký không thành công. Vui lòng kiểm tra lại.");
    } finally {
      setBusy(false);
    }
  };

  // Copy team code helper
  const copyToClipboard = (val: string) => {
    void navigator.clipboard.writeText(val);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const studentName: string = String(profile?.HoTen ?? user?.name ?? "Sinh viên");
  const studentMssv: string = String(profile?.MSSV ?? user?.username ?? "—");
  const studentClass: string = String(profile?.TenLop ?? "Khoa CNTT");

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Toast Dialogs */}
      {error && <NoticeDialog kind="error" message={error} onClose={() => setError("")} />}
      {notice && <NoticeDialog kind="success" message={notice} onClose={() => setNotice("")} />}

      {/* 4 Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {/* Card 1 */}
        <div
          style={{
            background: "#ffffff",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            🎯
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
              Đang mở đăng ký
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>
              {activities.length} <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>hoạt động</span>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div
          style={{
            background: "#ffffff",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#ecfdf5",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            📝
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
              Đã đăng ký
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#059669" }}>
              {registrations.length} <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>lượt</span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div
          style={{
            background: "#ffffff",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#f5f3ff",
              color: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            👥
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
              Đội thi tham gia
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#7c3aed" }}>
              {registrations.filter((r) => r.TenDoi).length}{" "}
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>đội</span>
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div
          style={{
            background: "#ffffff",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#fffbeb",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
            }}
          >
            ⭐
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>
              Điểm rèn luyện
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#d97706" }}>
              +{points.tongDiem}{" "}
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#059669", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>
                Đã duyệt
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation & Filter Bar */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          padding: "16px 20px",
          marginBottom: "24px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        {/* Category Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "🌟 Tất cả", count: activities.length },
            { id: "competitions", label: "🏆 Cuộc thi học thuật" },
            { id: "seminars", label: "🎤 Seminar & Tọa đàm" },
            { id: "support", label: "🤝 Hỗ trợ & Cổ vũ" },
            { id: "mine", label: `🎫 Đăng ký của tôi (${registrations.length})` },
            { id: "points", label: "⭐ Điểm rèn luyện" },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "10px",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: active ? "#2563eb" : "#f1f5f9",
                  color: active ? "#ffffff" : "#475569",
                  boxShadow: active ? "0 4px 12px rgba(37,99,235,0.25)" : "none",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search input & status filter (only when looking at activities) */}
        {activeTab !== "points" && activeTab !== "mine" && (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Tìm hoạt động, địa điểm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 12px 8px 34px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13.5px",
                  width: "220px",
                  outline: "none",
                }}
              />
              <span style={{ position: "absolute", left: "10px", top: "8px", opacity: 0.5, fontSize: "14px" }}>
                🔍
              </span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "open" | "registered")}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "13.5px",
                background: "#ffffff",
                color: "#334155",
                fontWeight: 500,
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="open">Đang mở đăng ký</option>
              <option value="registered">Đã đăng ký</option>
            </select>
          </div>
        )}
      </div>

      {/* VIEW 1: Activity Grid */}
      {activeTab !== "mine" && activeTab !== "points" && (
        <div>
          {loading ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "28px", marginBottom: "12px" }}>⏳</div>
              <div>Đang tải danh sách hoạt động học thuật…</div>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                padding: "60px 20px",
                textAlign: "center",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
              <h3 style={{ fontSize: "17px", color: "#1e293b", margin: "0 0 6px" }}>
                Không tìm thấy hoạt động nào phù hợp
              </h3>
              <p style={{ margin: 0, fontSize: "14px" }}>
                Hiện tại chưa có sự kiện nào thuộc bộ lọc này hoặc đang được chuẩn bị công bố.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: "20px",
              }}
            >
              {filteredActivities.map((act) => {
                const type = getActivityType(act);
                const reg = getStudentRegistration(act.MaHD);
                const isRegistered = Boolean(reg);
                const isTeam = act.HinhThucThi === "Theo đội";
                const isApproved = isActivityApproved(act);

                const badgeBg =
                  type === "competition"
                    ? "#ede9fe"
                    : type === "seminar"
                    ? "#e0f2fe"
                    : "#fef3c7";
                const badgeColor =
                  type === "competition"
                    ? "#6d28d9"
                    : type === "seminar"
                    ? "#0369a1"
                    : "#b45309";
                const badgeLabel =
                  type === "competition"
                    ? "🏆 Cuộc thi học thuật"
                    : type === "seminar"
                    ? "🎤 Seminar / Hội thảo"
                    : "🤝 Hỗ trợ & Cổ vũ";

                return (
                  <div
                    key={text(act, "MaHD")}
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      border: isRegistered ? "2px solid #22c55e" : "1px solid #e2e8f0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      overflow: "hidden",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
                    <div style={{ padding: "20px" }}>
                      {/* Top Badges */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "12px",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 700,
                            background: badgeBg,
                            color: badgeColor,
                          }}
                        >
                          {badgeLabel}
                        </span>

                        {isRegistered ? (
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 700,
                              background: "#dcfce7",
                              color: "#15803d",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            ✓ Đã đăng ký
                          </span>
                        ) : isApproved ? (
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: "#f1f5f9",
                              color: "#166534",
                            }}
                          >
                            🟢 Đang mở
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: "#fef3c7",
                              color: "#b45309",
                            }}
                          >
                            ⏳ Chưa duyệt kế hoạch
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#0f172a",
                          margin: "0 0 10px",
                          lineHeight: 1.45,
                        }}
                      >
                        {text(act, "TenHoatDong")}
                      </h3>

                      {/* Points Reward Pill */}
                      <div style={{ marginBottom: "14px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12.5px",
                            fontWeight: 700,
                            color: "#d97706",
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            padding: "3px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          ⭐ {type === "competition" ? "+5 điểm rèn luyện" : "+3 điểm rèn luyện"}
                        </span>
                      </div>

                      {/* Metadata Items */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "#475569" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <span>📅</span>
                          <span>
                            <strong>Thời gian:</strong> {text(act, "ThoiGianSeminar") || formatDateVn(act.ThoiGianBatDau || act.TgDuKien)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <span>📍</span>
                          <span>
                            <strong>Địa điểm:</strong> {text(act, "DiaDiem") || "Trung tâm thư viện F401, trường Đại học Công Thương Thành phố Hồ Chí Minh"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <span>👥</span>
                          <span>
                            <strong>Hình thức:</strong>{" "}
                            {isTeam ? "Thi đấu theo đội (2–5 bạn)" : type === "competition" ? "Cá nhân dự thi" : "Tham dự tự do"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                          <span>⏳</span>
                          <span>
                            <strong>Hạn đăng ký:</strong> {formatDateOnly(act.HanDangKy)}
                          </span>
                        </div>
                      </div>

                      {/* Short Description */}
                      {Boolean(text(act, "NoiDung")) && (
                        <div
                          style={{
                            marginTop: "14px",
                            padding: "10px 12px",
                            background: "#f8fafc",
                            borderRadius: "8px",
                            fontSize: "12.5px",
                            color: "#64748b",
                            lineHeight: 1.5,
                            maxHeight: "68px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {text(act, "NoiDung")}
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div
                      style={{
                        padding: "14px 20px",
                        background: isRegistered ? "#f0fdf4" : "#f8fafc",
                        borderTop: isRegistered ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      {isRegistered ? (
                        <>
                          <div style={{ fontSize: "12px", color: "#15803d", fontWeight: 600 }}>
                            {reg?.TenDoi ? `Đội: ${String(reg.TenDoi)}` : "Đã ghi nhận đăng ký"}
                          </div>
                          <button
                            type="button"
                            onClick={() => setTicketRegistration(reg || act)}
                            style={{
                              padding: "7px 14px",
                              borderRadius: "6px",
                              background: "#ffffff",
                              color: "#15803d",
                              border: "1px solid #86efac",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                            }}
                          >
                            🎫 Xem vé & QR
                          </button>
                        </>
                      ) : !isApproved ? (
                        <>
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>Chờ phê duyệt</span>
                          <button
                            type="button"
                            disabled
                            style={{
                              padding: "8px 18px",
                              borderRadius: "8px",
                              background: "#f1f5f9",
                              color: "#94a3b8",
                              border: "1px solid #cbd5e1",
                              fontWeight: 700,
                              fontSize: "13.5px",
                              cursor: "not-allowed",
                            }}
                          >
                            Chưa mở đăng ký
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>Miễn phí tham gia</span>
                          <button
                            type="button"
                            onClick={() => openRegisterModal(act)}
                            style={{
                              padding: "8px 18px",
                              borderRadius: "8px",
                              background: type === "support" ? "#d97706" : "#2563eb",
                              color: "#ffffff",
                              border: "none",
                              fontWeight: 700,
                              fontSize: "13.5px",
                              cursor: "pointer",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                            }}
                          >
                            {type === "competition"
                              ? isTeam
                                ? "Đăng ký đội thi ➔"
                                : "Đăng ký dự thi ➔"
                              : type === "support"
                              ? "Đăng ký hỗ trợ / cổ vũ ➔"
                              : "Đăng ký tham dự ➔"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: My Registrations */}
      {activeTab === "mine" && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px", color: "#0f172a" }}>
                Danh sách hoạt động bạn đã đăng ký
              </h2>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b" }}>
                Xuất trình vé tham dự hoặc mã đội khi tham gia thi đấu và điểm danh nhận điểm rèn luyện.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: "#eff6ff",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              + Đăng ký thêm hoạt động mới
            </button>
          </div>

          {registrations.length === 0 ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎫</div>
              <h3 style={{ fontSize: "16px", color: "#1e293b", margin: "0 0 6px" }}>
                Bạn chưa đăng ký tham gia hoạt động nào
              </h3>
              <p style={{ fontSize: "13.5px", color: "#64748b", margin: "0 0 16px" }}>
                Hãy duyệt qua các cuộc thi, buổi seminar hoặc hoạt động cổ vũ để đăng ký và nhận điểm rèn luyện!
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  cursor: "pointer",
                }}
              >
                Khám phá hoạt động ngay
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "13.5px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", color: "#475569", fontWeight: 700 }}>Hoạt động</th>
                    <th style={{ padding: "12px 16px", color: "#475569", fontWeight: 700 }}>Hình thức</th>
                    <th style={{ padding: "12px 16px", color: "#475569", fontWeight: 700 }}>Ngày đăng ký</th>
                    <th style={{ padding: "12px 16px", color: "#475569", fontWeight: 700 }}>Trạng thái</th>
                    <th style={{ padding: "12px 16px", color: "#475569", fontWeight: 700, textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((row) => {
                    const isTeamLeader = row.VaiTroDoi === "Trưởng đội";
                    return (
                      <tr
                        key={text(row, "MaDK")}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                          <strong style={{ color: "#0f172a", display: "block", fontSize: "14px" }}>
                            {text(row, "TenHoatDong")}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            📍 {text(row, "DiaDiem") || "Trung tâm thư viện F401, trường Đại học Công Thương Thành phố Hồ Chí Minh"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                          {row.TenDoi ? (
                            <div>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  background: "#f5f3ff",
                                  color: "#6d28d9",
                                  fontWeight: 600,
                                  fontSize: "12.5px",
                                }}
                              >
                                Đội: {String(row.TenDoi)}
                              </span>
                              {isTeamLeader && (
                                <span
                                  style={{
                                    marginLeft: "6px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "#fee2e2",
                                    color: "#b91c1c",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                  }}
                                >
                                  Trưởng đội
                                </span>
                              )}
                            </div>
                          ) : (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                fontWeight: 600,
                                fontSize: "12.5px",
                              }}
                            >
                              {text(row, "HinhThuc") || "Cá nhân"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", verticalAlign: "middle", color: "#475569" }}>
                          {formatDateVn(row.NgayDK)}
                        </td>
                        <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: "#dcfce7",
                              color: "#15803d",
                              fontWeight: 700,
                              fontSize: "12px",
                            }}
                          >
                            ✓ {text(row, "TrangThai") || "Đã đăng ký"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", verticalAlign: "middle", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => setTicketRegistration(row)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                background: "#ffffff",
                                color: "#2563eb",
                                border: "1px solid #bfdbfe",
                                fontWeight: 600,
                                fontSize: "13px",
                                cursor: "pointer",
                              }}
                            >
                              🎫 Thẻ tham dự
                            </button>
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate("competitions")}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  background: "#f1f5f9",
                                  color: "#334155",
                                  border: "1px solid #cbd5e1",
                                  fontWeight: 600,
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                Đến cuộc thi →
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: Training Points */}
      {activeTab === "points" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Summary Box */}
          <div
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
              borderRadius: "16px",
              padding: "24px 28px",
              color: "#ffffff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase", opacity: 0.9 }}>
                Tổng điểm rèn luyện tích lũy học thuật
              </div>
              <div style={{ fontSize: "36px", fontWeight: 800, margin: "4px 0" }}>
                +{points.tongDiem} <span style={{ fontSize: "18px", fontWeight: 500 }}>điểm</span>
              </div>
              <div style={{ fontSize: "13px", opacity: 0.85 }}>
                Ghi nhận tự động từ tham gia cuộc thi, seminar, hoạt động hỗ trợ và cổ vũ.
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.2)",
                padding: "12px 20px",
                borderRadius: "12px",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: "12px", opacity: 0.9 }}>Học kỳ áp dụng</div>
              <div style={{ fontSize: "16px", fontWeight: 700 }}>Học kỳ 1 · 2026–2027</div>
            </div>
          </div>

          {/* Points Table */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 16px", color: "#0f172a" }}>
              Lịch sử ghi nhận điểm rèn luyện
            </h3>

            {points.chiTiet.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                Chưa có phát sinh điểm rèn luyện trong kỳ này.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", color: "#475569" }}>Hoạt động</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", color: "#475569" }}>Học kỳ</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", color: "#475569" }}>Số điểm</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", color: "#475569" }}>Nội dung / Tiêu chí</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {points.chiTiet.map((item, idx) => {
                    const pts = Number(item.SoDiem ?? 0);
                    return (
                      <tr key={text(item, "MaDiem") || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "#0f172a" }}>
                          {text(item, "TenHoatDong") || "Tham gia hoạt động khoa"}
                        </td>
                        <td style={{ padding: "14px 16px", color: "#64748b" }}>
                          {text(item, "NamHoc")} · {text(item, "HocKy")}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: pts > 0 ? "#059669" : "#dc2626",
                              fontSize: "14px",
                            }}
                          >
                            {pts > 0 ? `+${pts}` : pts} điểm
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "#475569" }}>
                          {text(item, "LyDo") || text(item, "NoiDung") || "Tham gia đúng quy định"}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "4px",
                              background: "#dcfce7",
                              color: "#15803d",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {text(item, "TrangThai") || "Đã ghi nhận"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {registeringActivity && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setRegisteringActivity(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  XÁC NHẬN ĐĂNG KÝ
                </span>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>
                  {text(registeringActivity, "TenHoatDong")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRegisteringActivity(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: "0 4px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleRegisterSubmit} style={{ padding: "24px" }}>
              {/* Event Quick Info */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  marginBottom: "20px",
                  fontSize: "13px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Thời gian: </span>
                  <strong>{text(registeringActivity, "ThoiGianSeminar") || formatDateVn(registeringActivity.ThoiGianBatDau || registeringActivity.TgDuKien)}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Địa điểm: </span>
                  <strong>{text(registeringActivity, "DiaDiem") || "Trung tâm thư viện F401, trường Đại học Công Thương Thành phố Hồ Chí Minh"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Thí sinh: </span>
                  <strong>{studentName} ({studentMssv})</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Điểm RL: </span>
                  <strong style={{ color: "#059669" }}>+5 điểm</strong>
                </div>
              </div>

              {/* Mode Switcher for Competitions */}
              {getActivityType(registeringActivity) === "competition" && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                    Chọn hình thức đăng ký:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setRegMode("team_create")}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        border: regMode === "team_create" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                        background: regMode === "team_create" ? "#eff6ff" : "#ffffff",
                        color: regMode === "team_create" ? "#1d4ed8" : "#475569",
                        fontWeight: 700,
                        fontSize: "13.5px",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      👥 Tạo đội thi mới
                      <small style={{ display: "block", fontWeight: 400, fontSize: "11px", marginTop: "2px" }}>
                        (Bạn làm Trưởng đội)
                      </small>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegMode("team_join")}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        border: regMode === "team_join" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                        background: regMode === "team_join" ? "#eff6ff" : "#ffffff",
                        color: regMode === "team_join" ? "#1d4ed8" : "#475569",
                        fontWeight: 700,
                        fontSize: "13.5px",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      🔗 Gia nhập đội đã có
                      <small style={{ display: "block", fontWeight: 400, fontSize: "11px", marginTop: "2px" }}>
                        (Nhập mã số đội)
                      </small>
                    </button>
                  </div>
                </div>
              )}

              {/* Form Fields: Team Create */}
              {regMode === "team_create" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Tên đội thi <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Code Warriors, CyberSentinels..."
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Thành viên trong đội (Tối đa 4 bạn khác)
                    </label>
                    <textarea
                      placeholder="Nhập các MSSV, cách nhau bởi dấu phẩy hoặc khoảng trắng (VD: 2001230002, 2001230003)"
                      rows={3}
                      value={teamMembersInput}
                      onChange={(e) => setTeamMembersInput(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13.5px",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                    <small style={{ color: "#64748b", fontSize: "12px", display: "block", marginTop: "4px" }}>
                      * Trưởng đội ({studentMssv}) đã được tự động tính vào đội.
                    </small>
                  </div>
                </div>
              )}

              {/* Form Fields: Team Join */}
              {regMode === "team_join" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Mã đội thi (Do Trưởng đội cung cấp) <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="Nhập mã đội (VD: 1, 2, 5...)"
                      value={joinTeamId}
                      onChange={(e) => setJoinTeamId(e.target.value)}
                      required
                      min={1}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <small style={{ color: "#64748b", fontSize: "12px", display: "block", marginTop: "4px" }}>
                      * Hỏi mã số đội từ bạn trưởng nhóm để cùng vào thi đấu.
                    </small>
                  </div>
                </div>
              )}

              {/* Form Fields: Support & Cheer */}
              {regMode === "support_cheer" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Nhiệm vụ đăng ký:
                    </label>
                    <select
                      value={supportRole}
                      onChange={(e) => setSupportRole(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        background: "#ffffff",
                      }}
                    >
                      <option value="Cổ vũ">📣 Cổ vũ đội tuyển & Khán phòng (+3 điểm RL)</option>
                      <option value="Hỗ trợ Ban tổ chức">📋 Hỗ trợ Ban tổ chức & Soát vé (+5 điểm RL)</option>
                      <option value="Hậu cần & Kỹ thuật">🛠️ Hậu cần, Âm thanh & Phòng máy (+5 điểm RL)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Ghi chú / Nguyện vọng đặc biệt (nếu có):
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Có mặt trước 30 phút, đi theo đội hình lớp..."
                      value={supportNote}
                      onChange={(e) => setSupportNote(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Individual Confirmation */}
              {regMode === "individual" && (
                <div
                  style={{
                    padding: "14px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: "10px",
                    color: "#065f46",
                    fontSize: "13.5px",
                    lineHeight: 1.5,
                  }}
                >
                  ✓ Bạn đang đăng ký tham gia với tư cách cá nhân. Sau khi xác nhận, thông tin tham dự và thẻ QR check-in sẽ được cấp tự động.
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setRegisteringActivity(null)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: "9px 24px",
                    borderRadius: "8px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
                  }}
                >
                  {busy ? "Đang xử lý…" : "Xác nhận đăng ký ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E-TICKET MODAL */}
      {ticketRegistration && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setTicketRegistration(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              maxWidth: "460px",
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ticket Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                color: "#ffffff",
                padding: "24px",
                textAlign: "center",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => setTicketRegistration(null)}
                style={{
                  position: "absolute",
                  right: "16px",
                  top: "16px",
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "22px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85 }}>
                Khoa Công Nghệ Thông Tin · HUIT
              </div>
              <h2 style={{ fontSize: "19px", fontWeight: 800, margin: "6px 0 0" }}>
                THẺ THAM DỰ HỌC THUẬT
              </h2>
              <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "2px" }}>
                MÃ VÉ: #{text(ticketRegistration, "MaDK") || "REG-2026"}
              </div>
            </div>

            {/* Ticket Content */}
            <div style={{ padding: "24px" }}>
              {/* Event Name */}
              <div style={{ textAlign: "center", marginBottom: "18px" }}>
                <h4 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  {text(ticketRegistration, "TenHoatDong")}
                </h4>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    background: "#ecfdf5",
                    color: "#059669",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  ✓ ĐÃ XÁC NHẬN THAM DỰ
                </span>
              </div>

              {/* QR Code Placeholder Graphic */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "2px dashed #cbd5e1",
                  borderRadius: "14px",
                  padding: "18px",
                  textAlign: "center",
                  margin: "0 auto 20px",
                  maxWidth: "180px",
                }}
              >
                <div style={{ fontSize: "72px", lineHeight: "1" }}>📲</div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px", fontWeight: 600 }}>
                  QR CHECK-IN ĐIỂM DANH
                </div>
              </div>

              {/* Attendee Info Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  fontSize: "13px",
                  background: "#f8fafc",
                  padding: "14px 18px",
                  borderRadius: "12px",
                  marginBottom: "18px",
                }}
              >
                <div>
                  <div style={{ color: "#64748b", fontSize: "11.5px" }}>HỌ VÀ TÊN</div>
                  <strong style={{ color: "#0f172a" }}>{studentName}</strong>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: "11.5px" }}>MSSV / LỚP</div>
                  <strong style={{ color: "#0f172a" }}>{studentMssv} · {studentClass}</strong>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: "11.5px" }}>HÌNH THỨC</div>
                  <strong style={{ color: "#0f172a" }}>
                    {ticketRegistration.TenDoi ? `Đội ${String(ticketRegistration.TenDoi)}` : "Cá nhân"}
                  </strong>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: "11.5px" }}>ĐỊA ĐIỂM</div>
                  <strong style={{ color: "#0f172a" }}>{text(ticketRegistration, "DiaDiem") || "Trung tâm thư viện F401, trường Đại học Công Thương Thành phố Hồ Chí Minh"}</strong>
                </div>
              </div>

              {/* Share Team Code (if team leader) */}
              {Boolean(ticketRegistration.TenDoi) && (
                <div
                  style={{
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: "10px",
                    padding: "12px",
                    marginBottom: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", color: "#6d28d9", fontWeight: 700 }}>
                      MÃ ĐỘI THI ĐỂ MỜI BẠN BÈ:
                    </span>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#5b21b6" }}>
                      #{text(ticketRegistration, "MaDoi") || text(ticketRegistration, "MaDK")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(text(ticketRegistration, "MaDoi") || text(ticketRegistration, "MaDK"))}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "#7c3aed",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {copiedCode ? "✓ Đã chép" : "📋 Sao chép mã"}
                  </button>
                </div>
              )}

              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", textAlign: "center", lineHeight: 1.5 }}>
                Vui lòng xuất trình mã này tại bàn tiếp đón của Ban tổ chức để hoàn tất điểm danh và ghi nhận điểm rèn luyện.
              </p>

              <button
                type="button"
                onClick={() => setTicketRegistration(null)}
                style={{
                  width: "100%",
                  marginTop: "18px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Đóng vé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
