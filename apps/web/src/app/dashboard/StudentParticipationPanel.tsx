"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import NoticeDialog from "./NoticeDialog";

type Row = Record<string, unknown>;
type TeamMemberLookup = { hoTen: string; tenLop: string };

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "");
const prizeLines = (value: unknown) => String(value ?? "").split(/[;\r\n]+/).map((line) => line.trim()).filter(Boolean);

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

function formatRegistrationDeadline(value: unknown): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return String(value);

  const timeZone = "Asia/Ho_Chi_Minh";
  const time = date.toLocaleTimeString("vi-VN", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const day = date.toLocaleDateString("vi-VN", {
    timeZone, day: "2-digit", month: "2-digit", year: "numeric",
  });
  return `${time} ${day}`;
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
  const [selectedActivity, setSelectedActivity] = useState<Row | null>(null);

  // Registration Form States
  const [regMode, setRegMode] = useState<"individual" | "team_create" | "team_join" | "support_cheer">("individual");
  const [teamName, setTeamName] = useState("");
  const [teamMemberMssvs, setTeamMemberMssvs] = useState(["", "", "", ""]);
  const [teamMemberLookups, setTeamMemberLookups] = useState<Record<string, TeamMemberLookup>>({});
  const [joinTeamId, setJoinTeamId] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectAdvisor, setProjectAdvisor] = useState("");
  const [supportRole, setSupportRole] = useState("Cổ vũ");
  const [supportNote, setSupportNote] = useState("");

  // Feedback states
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedTeamCode, setCopiedTeamCode] = useState("");

  useEffect(() => {
    if (regMode !== "team_create") return;
    let active = true;
    const mssvs = Array.from(new Set(teamMemberMssvs.map((value) => value.trim()).filter((value) => value.length >= 8)));
    Promise.all(mssvs.map(async (mssv) => {
      try {
        const student = await workflowRequest<{ mssv: string; hoTen: string; tenLop: string }>(`/registrations/students/${encodeURIComponent(mssv)}`);
        return [mssv, { hoTen: student.hoTen, tenLop: student.tenLop }] as const;
      } catch {
        return [mssv, null] as const;
      }
    })).then((results) => {
      if (!active) return;
      setTeamMemberLookups(Object.fromEntries(results.filter((item): item is readonly [string, TeamMemberLookup] => item[1] !== null)));
    });
    return () => { active = false; };
  }, [regMode, teamMemberMssvs]);

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

  const isRegistrationOpen = (row: Row): boolean => {
    if (!isActivityApproved(row)) return false;
    if (row.MoDangKySauHan === true || row.MoDangKySauHan === 1) return true;
    if (!row.HanDangKy) return true;
    const deadline = new Date(String(row.HanDangKy)).getTime();
    return Number.isFinite(deadline) && deadline >= Date.now();
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
      if (statusFilter === "open" && (isReg || !isRegistrationOpen(act))) return false;

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
    setTeamMemberMssvs(["", "", "", ""]);
    setJoinTeamId("");
    setProjectTitle("");
    setProjectAdvisor("");
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
        if (type === "competition" && (!projectTitle.trim() || !projectAdvisor.trim())) {
          setError("Vui lòng nhập tên đề tài và giáo viên hướng dẫn.");
          setBusy(false);
          return;
        }
        const res = await workflowRequest<{ message?: string }>("/registrations/individual", {
          method: "POST",
          body: { maHD, hinhThuc, ...(type === "competition" ? { tenDeTai: projectTitle.trim(), gvhd: projectAdvisor.trim() } : {}) },
        });
        setNotice(res.message || "Đăng ký cá nhân thành công!");
      } else if (regMode === "team_create") {
        if (!teamName.trim()) {
          setError("Vui lòng nhập tên đội thi");
          setBusy(false);
          return;
        }
        if (!projectTitle.trim() || !projectAdvisor.trim()) {
          setError("Vui lòng nhập tên đề tài và giáo viên hướng dẫn.");
          setBusy(false);
          return;
        }
        const memberList = teamMemberMssvs.map((m) => m.trim()).filter(Boolean);
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
            tenDeTai: projectTitle.trim(),
            gvhd: projectAdvisor.trim(),
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

  const copyTeamCode = async (teamCode: string) => {
    try {
      await navigator.clipboard.writeText(teamCode);
      setCopiedTeamCode(teamCode);
      setTimeout(() => setCopiedTeamCode((current) => current === teamCode ? "" : current), 2000);
    } catch {
      setError("Không thể sao chép mã đội.");
    }
  };

  const studentName: string = String(profile?.HoTen ?? user?.name ?? "Sinh viên");
  const studentMssv: string = String(profile?.MSSV ?? user?.username ?? "—");

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
              {activities.filter(isRegistrationOpen).length} <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>hoạt động</span>
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap", minWidth: 0 }}>
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
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
                  width: "100%",
                  boxSizing: "border-box",
                  outline: "none",
                  paddingRight: "34px",
                }}
              />
              <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
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
                flex: "0 1 180px",
                minWidth: "140px",
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
                const canRegister = isRegistrationOpen(act);
                const registrationFormat = text(act, "TheLe").split(/[.;\n]/)[0].trim();

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
                    <div style={{ padding: "18px 20px 20px" }}>
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
                        ) : canRegister ? (
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
                            🟢 {act.MoDangKySauHan ? "Đang mở lại" : "Đang mở"}
                          </span>
                        ) : isApproved ? (
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: "#fff7ed",
                              color: "#c2410c",
                            }}
                          >
                            ⏳ Hết hạn đăng ký
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
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "#0f172a",
                          margin: "0 0 10px",
                          lineHeight: 1.45,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedActivity(act)}
                          aria-label={`Xem chi tiết ${text(act, "TenHoatDong")}`}
                          style={{
                            padding: 0,
                            border: 0,
                            background: "transparent",
                            color: "inherit",
                            font: "inherit",
                            lineHeight: "inherit",
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          {text(act, "TenHoatDong")}
                        </button>
                      </h3>

                      {/* Points Reward Pill */}
                      <div >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                          gap: "4px",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#d97706",
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            maxWidth: "100%",
                            whiteSpace: "normal",
                          }}
                        >
                          {type === "competition" ? (
                            <>
                              <span>🏆</span>
                              <span>
                                {prizeLines(act.GiaiThuong).length
                                  ? prizeLines(act.GiaiThuong).map((line, index) => <span key={`${index}-${line}`} style={{ display: "block" }}>{line}</span>)
                                  : "Xem thể lệ cuộc thi"}
                              </span>
                            </>
                          ) : type === "seminar"
                            ? `⭐ ${text(act, "DiemRenLuyen") ? `+${text(act, "DiemRenLuyen")} điểm rèn luyện` : "Chưa cập nhật điểm rèn luyện"}`
                            : "⭐ +3 điểm rèn luyện"}
                        </span>
                      </div>

                      {/* Metadata Items */}
                      <div style={{ marginTop: "14px", display: "grid", gap: "8px", fontSize: "15px", lineHeight: 1.5, color: "#334155" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                          <span >📅</span>
                          <span>
                            <strong>Thời gian:</strong> {type === "competition" && text(act, "TgDuKien")
                              ? text(act, "TgDuKien")
                              : formatDateVn(act.ThoiGianBatDau || text(act, "ThoiGianSeminar") || act.TgBatDau || act.TgDuKien)}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                          <span >📍</span>
                          <span>
                            <strong>Địa điểm:</strong> {text(act, "DiaDiem") || "Trung tâm thư viện F401, trường Đại học Công Thương Thành phố Hồ Chí Minh"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                          <span >👥</span>
                          <span>
                            <strong>Hình thức:</strong>{" "}
                            {type === "competition" ? registrationFormat || (isTeam ? "Thi đấu theo đội" : "Cá nhân dự thi") : "Tham dự tự do"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                          <span >⏳</span>
                          <span>
                            <strong>Hạn đăng ký:</strong> {formatRegistrationDeadline(act.HanDangKy)}
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
                            fontSize: "14px",
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
                        justifyContent: "flex-end",
                        alignItems: "center",
                      }}
                    >
                      {isRegistered ? (
                        <div>
                          {reg?.TenDoi ? `Đội: ${String(reg.TenDoi)}` : "Đã ghi nhận đăng ký"}
                        </div>
                      ) : !canRegister ? (
                        <>
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
                            {isApproved ? "Đã hết hạn đăng ký" : "Chưa mở đăng ký"}
                          </button>
                        </>
                      ) : (
                        <>
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
                Theo dõi trạng thái đăng ký và xem mã đội thi của bạn.
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
                    const teamCode = text(row, "MaDoi");
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
                          <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {teamCode && (
                              <button
                                type="button"
                                onClick={() => void copyTeamCode(teamCode)}
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
                                {copiedTeamCode === teamCode ? "✓ Đã chép" : `Sao chép mã đội #${teamCode}`}
                              </button>
                            )}
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

      {/* ACTIVITY DETAILS MODAL */}
      {selectedActivity && (
        <div
          role="presentation"
          onClick={() => setSelectedActivity(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-activity-details-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "16px",
              background: "#ffffff",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <header style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", gap: "16px" }}>
              <div>
                <div style={{ color: "#2563eb", fontWeight: 700, fontSize: "12px", marginBottom: "6px" }}>Chi tiết hoạt động</div>
                <h2 id="student-activity-details-title" style={{ margin: 0, fontSize: "20px", lineHeight: 1.4, color: "#0f172a" }}>
                  {text(selectedActivity, "TenHoatDong")}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedActivity(null)} aria-label="Đóng chi tiết" style={{ border: 0, background: "transparent", color: "#64748b", fontSize: "24px", cursor: "pointer", alignSelf: "flex-start" }}>×</button>
            </header>
            <div style={{ padding: "22px 24px", display: "grid", gap: "16px", color: "#334155", fontSize: "14px", lineHeight: 1.6 }}>
              <div><strong>Thời gian:</strong> {getActivityType(selectedActivity) === "competition" && text(selectedActivity, "TgDuKien")
                ? text(selectedActivity, "TgDuKien")
                : text(selectedActivity, "ThoiGianSeminar") || formatDateVn(selectedActivity.ThoiGianBatDau || selectedActivity.TgBatDau || selectedActivity.TgDuKien)}</div>
              <div><strong>Địa điểm:</strong> {text(selectedActivity, "DiaDiem") || "Chưa cập nhật"}</div>
              <div><strong>Hạn đăng ký:</strong> {formatRegistrationDeadline(selectedActivity.HanDangKy)}</div>
              {Boolean(text(selectedActivity, "DoiTuongTG")) && <div><strong>Đối tượng dự thi/tham dự:</strong> {text(selectedActivity, "DoiTuongTG")}</div>}
              {Boolean(text(selectedActivity, "TheLe")) && <div><strong>Hình thức và thể lệ:</strong> {text(selectedActivity, "TheLe")}</div>}
              {Boolean(text(selectedActivity, "NoiDung")) && <div><strong>Nội dung:</strong> {text(selectedActivity, "NoiDung")}</div>}
              {Boolean(text(selectedActivity, "GiaiThuong")) && (
                <div>
                  <strong>Giải thưởng:</strong>
                  <div>{prizeLines(selectedActivity.GiaiThuong).map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}</div>
                </div>
              )}
            </div>
            <footer style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setSelectedActivity(null)} style={{ padding: "8px 16px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#ffffff", color: "#334155", fontWeight: 600, cursor: "pointer" }}>Đóng</button>
            </footer>
          </section>
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
              maxWidth: "820px",
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
                  <strong>{getActivityType(registeringActivity) === "competition" && text(registeringActivity, "TgDuKien")
                    ? text(registeringActivity, "TgDuKien")
                    : text(registeringActivity, "ThoiGianSeminar") || formatDateVn(registeringActivity.ThoiGianBatDau || registeringActivity.TgDuKien)}</strong>
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
                  <span style={{ color: "#64748b" }}>{getActivityType(registeringActivity) === "competition" ? "Giải thưởng: " : "Điểm RL: "}</span>
                  <strong style={{ color: "#059669" }}>{getActivityType(registeringActivity) === "competition"
                    ? prizeLines(registeringActivity.GiaiThuong).length
                      ? prizeLines(registeringActivity.GiaiThuong).map((line, index) => <span key={`${index}-${line}`} style={{ display: "block" }}>{line}</span>)
                      : "Xem thông báo cuộc thi"
                    : getActivityType(registeringActivity) === "seminar"
                      ? text(registeringActivity, "DiemRenLuyen") ? `+${text(registeringActivity, "DiemRenLuyen")} điểm` : "Chưa cập nhật"
                      : "+3 điểm"}</strong>
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

              {getActivityType(registeringActivity) === "competition" && regMode !== "team_join" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "#334155", fontSize: "13px", fontWeight: 700 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Tên đề tài <span style={{ color: "#dc2626" }}>*</span></span>
                    <input required maxLength={250} value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder="VD: Ứng dụng AI trong chuyển đổi số" style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box", fontSize: "14px", fontWeight: 400 }} />
                    <small style={{ color: "#64748b", fontSize: "12px", fontWeight: 400 }}>Đề tài cần liên quan đến chủ đề và thể lệ cuộc thi.</small>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", color: "#334155", fontSize: "13px", fontWeight: 700 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>Giáo viên hướng dẫn <span style={{ color: "#dc2626" }}>*</span></span>
                    <input required maxLength={150} value={projectAdvisor} onChange={(event) => setProjectAdvisor(event.target.value)} placeholder="Nhập họ tên giáo viên hướng dẫn" style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box", fontSize: "14px", fontWeight: 400 }} />
                  </label>
                </div>
              )}

              {/* Form Fields: Team Create */}
              {regMode === "team_create" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>Tên đội thi <span style={{ color: "#dc2626" }}>*</span></span>
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
                    <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "8px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", color: "#334155", textAlign: "left" }}>
                            <th style={{ padding: "10px 12px", width: "32%" }}>Mã số sinh viên</th>
                            <th style={{ padding: "10px 12px", width: "40%" }}>Họ và tên</th>
                            <th style={{ padding: "10px 12px", width: "28%" }}>Lớp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamMemberMssvs.map((mssv, index) => {
                            const student = teamMemberLookups[mssv.trim()];
                            return (
                              <tr key={index} style={{ borderTop: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "6px 8px" }}>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={mssv}
                                    onChange={(event) => setTeamMemberMssvs((current) => current.map((value, row) => row === index ? event.target.value.replace(/[^0-9]/g, "") : value))}
                                    placeholder="Nhập MSSV"
                                    aria-label={`MSSV thành viên ${index + 1}`}
                                    style={{ width: "100%", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box", font: "inherit" }}
                                  />
                                </td>
                                <td style={{ padding: "10px 12px", color: student ? "#0f172a" : "#94a3b8" }}>{student?.hoTen || (mssv.length >= 8 ? "Không tìm thấy sinh viên" : "Tự động tra cứu theo MSSV")}</td>
                                <td style={{ padding: "10px 12px", color: student ? "#0f172a" : "#94a3b8" }}>{student?.tenLop || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
    </div>
  );
}
