"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";
import { parseArticleContent } from "./newsContent";

type Row = Record<string, unknown>;
type SeminarAnnouncement = {
  activityId: string;
  article: { title: string; content: ReturnType<typeof parseArticleContent> } | null;
  unavailable?: boolean;
};

const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "");

const array = (value: unknown): Row[] => {
  try {
    const result = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};

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
    if (hours === "00" && mins === "00") return `${day}/${month}/${year}`;
    return `${hours}:${mins} ${day}/${month}/${year}`;
  } catch {
    return String(value);
  }
}

function toDateTimeLocal(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const read = () =>
  Promise.all([
    workflowRequest<Row[]>("/seminars?source=management"),
    workflowRequest<Row[]>("/news/activities").catch(() => []),
  ]);

export default function SeminarPanel({ user }: { user: AuthUser }) {
  const [list, setList] = useState<Row[]>([]);
  const [managed, setManaged] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [announcement, setAnnouncement] = useState<SeminarAnnouncement | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"speakers" | "agenda" | "materials">("speakers");
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceSeminarId, setAttendanceSeminarId] = useState("");
  const [attendanceStartsAt, setAttendanceStartsAt] = useState("");
  const [attendanceEndsAt, setAttendanceEndsAt] = useState("");
  const [attendanceQr, setAttendanceQr] = useState<{ image: string; endsAt: string } | null>(null);

  const isAdmin = user.roles.includes("ADMIN");
  const isAdminOrStaff = isAdmin || user.roles.includes("CANBOKHOA");
  const canCreateSeminar = isAdminOrStaff || user.roles.includes("GIANGVIEN");

  useEffect(() => {
    let active = true;
    void read()
      .then(([items, choices]) => {
        if (active) {
          setList(items);
          setManaged(choices);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không tải được danh sách seminar");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleSeminars = list.filter(
    (item) =>
      isAdminOrStaff ||
      text(item, "NguoiLap") === user.id ||
      item.TrangThai === "Đã công bố" ||
      item.TrangThai === "Đã duyệt" ||
      managed.some((choice) => Number(choice.MaHD) === Number(item.MaHD))
  );
  const seminar = visibleSeminars.find((item) => text(item, "MaHD") === selected) ?? visibleSeminars[0];
  const seminarActivityId = text(seminar, "MaHD");
  const currentAnnouncement = announcement?.activityId === seminarActivityId ? announcement : null;
  const publishedArticle = currentAnnouncement?.article;
  const seminarSection = publishedArticle?.content.seminarSection;
  const pdfData = publishedArticle?.content.pdfData;
  const pdfUrl = typeof pdfData === "string" && /^data:application\/(?:pdf|octet-stream);base64,JVBERi0/.test(pdfData)
    ? pdfData.replace("data:application/octet-stream;", "data:application/pdf;")
    : "";
  const canEditSeminar = Boolean(
    seminar?.MaSeminar &&
    (isAdmin || text(seminar, "NguoiLap") === user.id || managed.some((item) => Number(item.MaHD) === Number(seminar.MaHD)))
  );

  useEffect(() => {
    if (!seminarActivityId) return;
    let active = true;
    void workflowRequest<{ TieuDe: string; NoiDung: string } | null>(`/news/activities/${seminarActivityId}/announcement`)
      .then((row) => {
        if (active) {
          setAnnouncement({
            activityId: seminarActivityId,
            article: row ? { title: row.TieuDe, content: parseArticleContent(row.NoiDung) } : null,
          });
        }
      })
      .catch(() => {
        if (active) setAnnouncement({ activityId: seminarActivityId, article: null, unavailable: true });
      });
    return () => { active = false; };
  }, [seminarActivityId]);

  async function act(path: string, method: string, body: Row) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await workflowRequest(path, { method, body });
      const [items, choices] = await read();
      setList(items);
      setManaged(choices);
      setNotice("Đã lưu thông tin seminar thành công.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thực hiện được thao tác");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seminar) return;
    const data = new FormData(event.currentTarget);
    const speakers = String(data.get("dienGia") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((hoTen) => ({
        ...array(seminar?.DienGia).find((speaker) => text(speaker, "hoTen") === hoTen),
        hoTen,
      }));

    const agenda = String(data.get("chuongTrinh") ?? "")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const [thoiGian, noiDung, phuTrach] = line.split("|").map((v) => v.trim());
        return { thoiGian, noiDung, phuTrach: phuTrach || undefined };
      });

    if (agenda.some((item) => !item.thoiGian || !item.noiDung)) {
      setError("Mỗi dòng chương trình cần có thời gian và nội dung, ngăn cách bởi dấu | (VD: 07:30 - 08:00 | Khai mạc | Ban tổ chức).");
      return;
    }

    if (!seminar?.MaSeminar) return;
    const pointsInput = data.get("diemRenLuyen");
    void act(`/seminars/${text(seminar, "MaSeminar")}`, "PATCH", {
      dvChuTri: data.get("dvChuTri"),
      dvPhoiHop: data.get("dvPhoiHop"),
      thoiLuong: data.get("thoiLuong") ? Number(data.get("thoiLuong")) : undefined,
      diemRenLuyen: pointsInput !== null && String(pointsInput).trim() !== "" ? Number(pointsInput) : undefined,
      noiDung: data.get("noiDung") ? String(data.get("noiDung")).trim() : undefined,
      dienGia: speakers,
      chuongTrinh: agenda,
    }).then((ok) => {
      if (ok) setIsUpdateModalOpen(false);
    });
  }

  async function createAttendanceQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = new Date(attendanceStartsAt);
    const end = new Date(attendanceEndsAt);
    if (!attendanceSeminarId || !attendanceStartsAt || !attendanceEndsAt || end <= start) {
      setError("Vui lòng chọn seminar và thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    setAttendanceQr(null);
    try {
      const startsAt = start.toISOString();
      const endsAt = end.toISOString();
      const response = await workflowRequest<Row>(`/attendance/activities/${attendanceSeminarId}/qr`, {
        method: "POST",
        body: { startsAt, endsAt },
      });
      const token = response.maQRCode ?? response.MaQRCode;
      if (!token) throw new Error("API chưa trả về mã QR để hiển thị.");
      const image = await QRCode.toDataURL(String(token), { errorCorrectionLevel: "H", margin: 2, width: 320 });
      setAttendanceQr({ image, endsAt: String(response.TGHetHan ?? endsAt) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo mã QR điểm danh.");
    } finally {
      setBusy(false);
    }
  }


  async function createSeminar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const data = new FormData(event.currentTarget);
    const tgBatDau = String(data.get("tgBatDau") || "");
    const tgKetThuc = String(data.get("tgKetThuc") || "");
    if (!tgBatDau || !tgKetThuc) {
      setError("Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc.");
      setBusy(false);
      return;
    }
    if (new Date(tgKetThuc) <= new Date(tgBatDau)) {
      setError("Thời gian kết thúc phải sau thời gian bắt đầu.");
      setBusy(false);
      return;
    }

    const speakers = String(data.get("dienGia") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [hoTen, donVi] = line.split("–").map((v) => v.trim());
        return { hoTen, donVi: donVi || undefined };
      });

    const agenda = String(data.get("chuongTrinh") ?? "")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const [thoiGian, noiDung, phuTrach] = line.split("|").map((v) => v.trim());
        return { thoiGian, noiDung, phuTrach: phuTrach || undefined };
      });

    try {
      const res = await workflowRequest<Row>("/seminars", {
        method: "POST",
        body: {
          tenHoatDong: data.get("tenHoatDong"),
          chuDe: data.get("chuDe") || data.get("tenHoatDong"),
          tgBatDau: new Date(tgBatDau).toISOString(),
          tgKetThuc: new Date(tgKetThuc).toISOString(),
          hanDangKy: data.get("hanDangKy") ? new Date(String(data.get("hanDangKy"))).toISOString() : undefined,
          diaDiem: data.get("diaDiem") || "Trung tâm thư viện F401",
          slToiDa: data.get("slToiDa") ? Number(data.get("slToiDa")) : 150,
          thoiLuong: data.get("thoiLuong") ? Number(data.get("thoiLuong")) : 240,
          dvChuTri: data.get("dvChuTri") || "Khoa Công nghệ Thông tin",
          noiDung: data.get("noiDung") || undefined,
          dienGia: speakers.length ? speakers : undefined,
          chuongTrinh: agenda.length ? agenda : undefined,
        },
      });

      setList((items) => [res, ...items]);
      setSelected(text(res, "MaHD"));
      setIsCreateModalOpen(false);
      setNotice("Đã lưu bản nháp seminar.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo seminar");
    } finally {
      setBusy(false);
    }
  }

  function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seminar?.MaSeminar) return;
    const data = new FormData(event.currentTarget);
    void act(`/seminars/${text(seminar, "MaSeminar")}/materials`, "POST", {
      tenTep: data.get("tenTep"),
      urlTep: data.get("urlTep"),
      loaiTep: data.get("loaiTep"),
    });
  }

  return (
    <div style={{ width: "100%", paddingBottom: "40px" }}>
      {error && <NoticeDialog kind="error" message={error} onClose={() => setError("")} />}
      {notice && <NoticeDialog kind="success" message={notice} onClose={() => setNotice("")} />}

      {/* Header Banner */}
      <div
        style={{
          background: "#ffffff",
          padding: "20px 24px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 6px", color: "#0f172a", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>🎤</span>
            <span>Quản lý thông tin các buổi Seminar học thuật</span>
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
            Theo dõi kế hoạch, diễn giả, chương trình chi tiết, tài liệu thuyết trình và người tham dự seminar của Khoa CNTT.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          {canCreateSeminar && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                background: "#eff6ff",
                color: "#2563eb",
                fontWeight: 600,
                fontSize: "13px",
                textDecoration: "none",
                border: "1px solid #bfdbfe",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>➕</span>
              <span>Tạo Seminar mới</span>
            </button>
          )}

          <Link
            href="/dashboard/detailed-plans"
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              background: "#f1f5f9",
              color: "#334155",
              fontWeight: 600,
              fontSize: "13px",
              textDecoration: "none",
              border: "1px solid #cbd5e1",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>📋</span>
            <span>Kế hoạch tổ chức</span>
          </Link>
          {canCreateSeminar && <button
            type="button"
            disabled={!visibleSeminars.length}
            onClick={() => {
              const initial = seminar ?? visibleSeminars[0];
              setAttendanceSeminarId(text(initial, "MaHD"));
              setAttendanceStartsAt(toDateTimeLocal(initial?.ThoiGianBatDau));
              setAttendanceEndsAt(toDateTimeLocal(initial?.ThoiGianKetThuc));
              setAttendanceQr(null);
              setIsAttendanceModalOpen(true);
            }}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              background: "#eff6ff",
              color: "#2563eb",
              fontWeight: 600,
              fontSize: "13px",
              border: "1px solid #bfdbfe",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: visibleSeminars.length ? "pointer" : "not-allowed",
              opacity: visibleSeminars.length ? 1 : 0.55,
            }}
          >
            <span>📱</span>
            <span>Điểm danh QR</span>
          </button>}
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Seminar selection list */}
        <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <strong style={{ fontSize: "14px", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Danh sách Seminar ({visibleSeminars.length})</strong>
          </div>
          {loading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>Đang tải danh sách seminar…</div>
          ) : visibleSeminars.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>Chưa có seminar nào được lập.</div>
          ) : visibleSeminars.map((item) => {
            const isCurrent = item === seminar;
            const timeText = text(item, "ThoiGianSeminar") || formatDateVn(item.ThoiGianBatDau || item.TgDuKien);
            const venueText = text(item, "DiaDiem") || "Trung tâm thư viện F401";
            return <button key={text(item, "MaHD")} type="button" onClick={() => setSelected(text(item, "MaHD"))} style={{ display: "block", width: "100%", padding: "16px 20px", border: 0, borderBottom: "1px solid #f1f5f9", borderLeft: isCurrent ? "4px solid #2563eb" : "4px solid transparent", background: isCurrent ? "#eff6ff" : "#fff", textAlign: "left", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px", gap: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: item.TrangThai === "Đã công bố" ? "#ecfdf5" : "#f1f5f9", color: item.TrangThai === "Đã công bố" ? "#15803d" : "#475569" }}>{text(item, "TrangThai") || "Đã duyệt"}</span>
                <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600 }}>Mã hoạt động #{text(item, "MaHD")}</span>
              </div>
              <strong style={{ display: "block", marginBottom: "6px", fontSize: "14.5px", color: isCurrent ? "#1d4ed8" : "#0f172a", lineHeight: 1.4 }}>{text(item, "ChuDe") || text(item, "TenHoatDong")}</strong>
              <span style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>📅 {timeText}<br />📍 {venueText}</span>
            </button>;
          })}
        </div>

        {/* Seminar detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
        {seminar ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Top Detail Card */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "24px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px", color: "#0f172a", lineHeight: 1.35 }}>
                    {text(seminar, "ChuDe") || text(seminar, "TenHoatDong")}
                  </h2>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {canEditSeminar && (
                    <button
                      type="button"
                      onClick={() => setIsUpdateModalOpen(true)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        background: "#eff6ff",
                        color: "#2563eb",
                        border: "1px solid #bfdbfe",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>⚙️</span>
                      <span>Cập nhật thông tin</span>
                    </button>
                  )}
                  {canEditSeminar && (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "#f0fdf4",
                        color: "#166534",
                        border: "1px solid #bbf7d0",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      ✓ Quản trị
                    </span>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "14px",
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "16px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <span style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Thời gian tổ chức:</span>
                  <strong style={{ color: "#0f172a" }}>
                    {text(seminar, "ThoiGianSeminar") || formatDateVn(seminar.ThoiGianBatDau || seminar.TgDuKien)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Địa điểm:</span>
                  <strong style={{ color: "#0f172a" }}>
                    {text(seminar, "DiaDiem") || "Trung tâm thư viện F401, trường Đại học Công Thương Thành phố Hồ Chí Minh"}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Đơn vị chủ trì:</span>
                  <strong style={{ color: "#0f172a" }}>{text(seminar, "DVChuTri") || "Khoa Công nghệ Thông tin"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Đơn vị phối hợp:</span>
                  <strong style={{ color: "#0f172a" }}>{text(seminar, "DVPhoiHop") || "Bộ môn & CLB Học thuật"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Thời lượng:</span>
                  <strong style={{ color: "#0f172a" }}>{text(seminar, "ThoiLuong") ? `${text(seminar, "ThoiLuong")} phút` : "240 phút (07h30 - 11h30)"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748b", display: "block", marginBottom: "2px" }}>Quyền lợi điểm RL:</span>
                  <strong style={{ color: "#059669" }}>
                    {text(seminar, "DiemRenLuyen") ? `+${text(seminar, "DiemRenLuyen")} Điểm rèn luyện` : "Chưa cập nhật"}
                  </strong>
                </div>
              </div>

              {/* Description */}
              <div style={{ fontSize: "14px", color: "#334155", lineHeight: "1.6", background: "#ffffff", padding: "10px 0 0" }}>
                {Boolean(text(seminar, "MucDich")) && (
                  <div style={{ marginBottom: "12px" }}>
                    <strong style={{ color: "#0f172a" }}>Mục đích:</strong>
                    <div style={{ marginTop: "4px", color: "#475569", lineHeight: "1.6" }}>
                      {text(seminar, "MucDich")}
                    </div>
                  </div>
                )}
                <div>
                  <strong style={{ color: "#0f172a" }}>
                    {seminarSection ? "I. Chủ đề và nội dung" : "Chủ đề & Nội dung:"}
                  </strong>
                  <div style={{ marginTop: "6px", whiteSpace: "pre-line" }}>
                    {!currentAnnouncement ? "Đang tải thông báo đã công bố…" :
                      currentAnnouncement.unavailable ? "Không tải được thông báo đã công bố." :
                      publishedArticle ? (
                        <>
                          {!seminarSection && <strong>{publishedArticle.title}</strong>}
                          {(seminarSection || publishedArticle.content.text) && (
                            <p style={{ margin: "6px 0" }}>{seminarSection || publishedArticle.content.text}</p>
                          )}
                          {pdfUrl && (
                            <details style={{ marginTop: "8px" }}>
                              <summary style={{ color: "#1d4ed8", cursor: "pointer", fontWeight: 600 }}>
                                Xem thông báo PDF ({publishedArticle.content.pdfName || "tai-lieu.pdf"})
                              </summary>
                              <iframe
                                title="Thông báo seminar đã công bố"
                                src={pdfUrl}
                                loading="lazy"
                                style={{ width: "100%", height: "min(65vh, 620px)", marginTop: "8px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                              />
                              <a href={pdfUrl} download={publishedArticle.content.pdfName || "tai-lieu.pdf"}>
                                Tải thông báo PDF
                              </a>
                            </details>
                          )}
                        </>
                      ) : text(seminar, "NoiDung") || text(seminar, "MoTa") || "Chưa cập nhật"}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Tabs: Speakers, Agenda, Materials */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                overflow: "hidden",
              }}
            >
              {/* Tab Navigation */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  paddingRight: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex" }}>
                  {[
                    { id: "speakers", label: `👥 Diễn giả (${array(seminar.DienGia).length})` },
                    { id: "agenda", label: `⏱️ Chương trình (${array(seminar.ChuongTrinh).length})` },
                    { id: "materials", label: `📁 Tài liệu & Slide (${array(seminar.TaiLieu).length})` },
                  ].map((t) => {
                    const active = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id as any)}
                        style={{
                          padding: "14px 20px",
                          border: "none",
                          borderBottom: active ? "2.5px solid #2563eb" : "2.5px solid transparent",
                          background: active ? "#ffffff" : "transparent",
                          color: active ? "#2563eb" : "#475569",
                          fontWeight: active ? 700 : 600,
                          fontSize: "13.5px",
                          cursor: "pointer",
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {canEditSeminar && (
                  <button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(true)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      background: "#eff6ff",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      fontWeight: 600,
                      fontSize: "12.5px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>✏️</span>
                    <span>Cập nhật nội dung</span>
                  </button>
                )}
              </div>

              <div style={{ padding: "24px" }}>
                {/* TAB 1: Speakers */}
                {activeTab === "speakers" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                        Danh sách Diễn giả & Khách mời báo cáo
                      </h3>
                      {canEditSeminar && (
                        <button
                          type="button"
                          onClick={() => setIsUpdateModalOpen(true)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#2563eb",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          + Thêm / Sửa diễn giả
                        </button>
                      )}
                    </div>

                    {!array(seminar.DienGia).length ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: "8px" }}>
                        Chưa có thông tin diễn giả cụ thể.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                        {array(seminar.DienGia).map((sp, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "16px",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#f8fafc",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                width: "42px",
                                height: "42px",
                                borderRadius: "50%",
                                background: "#dbeafe",
                                color: "#1d4ed8",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "20px",
                                flexShrink: 0,
                              }}
                            >
                              👨‍🏫
                            </div>
                            <div>
                              <strong style={{ fontSize: "15px", color: "#0f172a", display: "block" }}>
                                {text(sp, "hoTen")}
                              </strong>
                              <span style={{ fontSize: "12.5px", color: "#2563eb", fontWeight: 600, display: "block", marginTop: "2px" }}>
                                {text(sp, "chuDeTrinhBay") || "Báo cáo viên chuyên đề"}
                              </span>
                              <span style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", display: "block" }}>
                                {text(sp, "donVi") || "Chuyên gia khách mời"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Agenda */}
                {activeTab === "agenda" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                        Lịch trình chi tiết buổi Seminar (Timeline)
                      </h3>
                      {canEditSeminar && (
                        <button
                          type="button"
                          onClick={() => setIsUpdateModalOpen(true)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#2563eb",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          + Chỉnh sửa lịch trình
                        </button>
                      )}
                    </div>

                    {!array(seminar.ChuongTrinh).length ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: "8px" }}>
                        Chưa cập nhật chương trình chi tiết.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {array(seminar.ChuongTrinh).map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "16px",
                              padding: "12px 16px",
                              borderRadius: "8px",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <span
                              style={{
                                width: "130px",
                                flexShrink: 0,
                                fontWeight: 700,
                                color: "#2563eb",
                                fontSize: "13px",
                              }}
                            >
                              ⏰ {text(item, "thoiGian")}
                            </span>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: "14px", color: "#0f172a", fontWeight: 500 }}>
                                {text(item, "noiDung")}
                              </span>
                            </div>
                            {Boolean(text(item, "phuTrach") || text(item, "dvChuTri")) && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#64748b",
                                  background: "#ffffff",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                {text(item, "phuTrach") || text(item, "dvChuTri")}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: Materials */}
                {activeTab === "materials" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                        Tài liệu, Slide & Liên kết thuyết trình
                      </h3>
                    </div>

                    {!array(seminar.TaiLieu).length ? (
                      <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: "8px", marginBottom: "20px" }}>
                        Chưa có tài liệu đính kèm.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                        {array(seminar.TaiLieu).map((f) => (
                          <div
                            key={text(f, "MaTep")}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "12px 16px",
                              borderRadius: "8px",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "20px" }}>📄</span>
                              <div>
                                <strong style={{ fontSize: "13.5px", color: "#0f172a", display: "block" }}>
                                  {text(f, "TenTep")}
                                </strong>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>
                                  {text(f, "LoaiTep") || "Tài liệu seminar"}
                                </span>
                              </div>
                            </div>

                            <a
                              href={text(f, "UrlTep")}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: "6px 14px",
                                borderRadius: "6px",
                                background: "#2563eb",
                                color: "#ffffff",
                                textDecoration: "none",
                                fontSize: "12.5px",
                                fontWeight: 600,
                              }}
                            >
                              Tải về / Xem ➔
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add material form */}
                    {canEditSeminar && (
                      <form
                        onSubmit={saveMaterial}
                        style={{
                          background: "#f8fafc",
                          padding: "18px 20px",
                          borderRadius: "10px",
                          border: "1px dashed #cbd5e1",
                        }}
                      >
                        <h4 style={{ margin: "0 0 12px", fontSize: "14px", color: "#1e293b" }}>
                          + Thêm tài liệu / đường dẫn tài liệu mới
                        </h4>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px auto", gap: "10px", alignItems: "end" }}>
                          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px", color: "#475569" }}>
                            <span>Tên tài liệu:</span>
                            <input
                              name="tenTep"
                              required
                              placeholder="VD: Slide báo cáo chuyên đề khởi nghiệp..."
                              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                            />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px", color: "#475569" }}>
                            <span>URL tài liệu (link Drive/Web):</span>
                            <input
                              name="urlTep"
                              type="url"
                              required
                              placeholder="https://..."
                              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                            />
                          </label>
                          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px", color: "#475569" }}>
                            <span>Loại:</span>
                            <input
                              name="loaiTep"
                              placeholder="PDF/Slide"
                              defaultValue="Slide bài giảng"
                              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                            />
                          </label>
                          <button
                            type="submit"
                            disabled={busy}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "6px",
                              background: "#059669",
                              color: "#ffffff",
                              border: "none",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                              height: "36px",
                            }}
                          >
                            Lưu tài liệu
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "48px 24px", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#fff", color: "#64748b", textAlign: "center" }}>
            {loading ? "Đang tải seminar…" : visibleSeminars.length === 0 ? "Chưa có seminar nào được lập." : "Chọn seminar để xem thông tin và danh sách sinh viên đăng ký."}
          </div>
        )}
      </div>
      </div>

      {isAttendanceModalOpen && (
        <div className={s.modalOverlay} role="presentation" onClick={() => setIsAttendanceModalOpen(false)}>
          <div className={`${s.modalCard} ${s.seminarAttendanceModal}`} role="dialog" aria-modal="true" aria-labelledby="seminar-attendance-title" onClick={(event) => event.stopPropagation()}>
            <div className={s.modalHeader}>
              <div>
                <h3 id="seminar-attendance-title">Điểm danh Seminar bằng QR</h3>
                <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: "13px" }}>Chọn seminar và thời gian mã QR có hiệu lực.</p>
              </div>
              <button type="button" className={s.modalCloseBtn} aria-label="Đóng" onClick={() => setIsAttendanceModalOpen(false)}>×</button>
            </div>

            <form onSubmit={createAttendanceQr}>
              <div className={s.modalBody} style={{ padding: "20px 24px", display: "grid", gap: "16px" }}>
                <label className={s.businessField}>
                  <span>Seminar</span>
                  <select
                    className={s.businessInput}
                    value={attendanceSeminarId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const nextSeminar = visibleSeminars.find((item) => text(item, "MaHD") === nextId);
                      setAttendanceSeminarId(nextId);
                      setAttendanceStartsAt(toDateTimeLocal(nextSeminar?.ThoiGianBatDau));
                      setAttendanceEndsAt(toDateTimeLocal(nextSeminar?.ThoiGianKetThuc));
                      setAttendanceQr(null);
                    }}
                    required
                  >
                    <option value="">Chọn seminar</option>
                    {visibleSeminars.map((item) => <option key={text(item, "MaHD")} value={text(item, "MaHD")}>
                      {text(item, "ChuDe") || text(item, "TenHoatDong")} · #{text(item, "MaHD")}
                    </option>)}
                  </select>
                </label>

                <div className={s.seminarAttendanceTimes}>
                  <label className={s.businessField}>
                    <span>Thời gian bắt đầu</span>
                    <input className={s.businessInput} type="datetime-local" value={attendanceStartsAt} onChange={(event) => setAttendanceStartsAt(event.target.value)} required />
                  </label>
                  <label className={s.businessField}>
                    <span>Thời gian kết thúc</span>
                    <input className={s.businessInput} type="datetime-local" value={attendanceEndsAt} onChange={(event) => setAttendanceEndsAt(event.target.value)} required />
                  </label>
                </div>
                <p style={{ margin: 0, color: "#64748b", fontSize: "12px", lineHeight: 1.5 }}>
                  Mã QR chỉ điểm danh được trong khoảng thời gian đã chọn. Thời gian được lấy sẵn từ kế hoạch Seminar và có thể chỉnh sửa.
                </p>

                {attendanceQr && (
                  <div className={s.attendanceQr} style={{ marginTop: 0 }}>
                    <strong>Sinh viên quét mã bằng ứng dụng để điểm danh</strong>
                    <img src={attendanceQr.image} alt="Mã QR điểm danh Seminar" width={320} height={320} />
                    <span>Mã hết hạn lúc {formatDateVn(attendanceQr.endsAt)}</span>
                    <a href={attendanceQr.image} download={`diem-danh-seminar-${attendanceSeminarId}.png`}>Tải mã QR</a>
                  </div>
                )}
              </div>
              <div className={s.modalFooter} style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 24px" }}>
                <button type="button" className={s.secondaryButton} onClick={() => setIsAttendanceModalOpen(false)}>Đóng</button>
                <button type="submit" className={s.primary} disabled={busy || !attendanceSeminarId}>{busy ? "Đang tạo…" : attendanceQr ? "Tạo lại mã QR" : "Tạo mã QR"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: CẬP NHẬT THÔNG TIN SEMINAR */}
      {isUpdateModalOpen && seminar && (
        <div
          onClick={() => setIsUpdateModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "840px",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚙️</span>
                  <span>Cập nhật thông tin bổ sung buổi Seminar</span>
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  {text(seminar, "ChuDe") || text(seminar, "TenHoatDong")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsUpdateModalOpen(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: "16px",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={saveDetails} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div
                style={{
                  padding: "24px",
                  overflowY: "auto",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                {/* Row 1: Đơn vị chủ trì, phối hợp, thời lượng */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Đơn vị chủ trì:</span>
                    <input
                      name="dvChuTri"
                      defaultValue={text(seminar, "DVChuTri") || "Khoa Công nghệ Thông tin"}
                      placeholder="VD: Khoa Công nghệ Thông tin"
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", fontWeight: 500 }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Đơn vị phối hợp:</span>
                    <input
                      name="dvPhoiHop"
                      defaultValue={text(seminar, "DVPhoiHop") || "Bộ môn & CLB Học thuật"}
                      placeholder="VD: Bộ môn & Doanh nghiệp"
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", fontWeight: 500 }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Thời lượng (phút):</span>
                    <input
                      name="thoiLuong"
                      type="number"
                      min={1}
                      max={1440}
                      defaultValue={text(seminar, "ThoiLuong") || 240}
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", fontWeight: 500 }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Quyền lợi điểm rèn luyện:</span>
                    <input
                      name="diemRenLuyen"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      defaultValue={text(seminar, "DiemRenLuyen")}
                      disabled={Boolean(seminar.DiemRenLuyenDaKhoa)}
                      placeholder="Số điểm đề xuất"
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", fontWeight: 500, background: seminar.DiemRenLuyenDaKhoa ? "#f1f5f9" : "#fff" }}
                    />
                    {Boolean(seminar.DiemRenLuyenDaKhoa) && (
                      <span style={{ color: "#64748b", fontSize: "11px", fontWeight: 400 }}>Theo kế hoạch đã duyệt hoặc đã công bố</span>
                    )}
                  </label>
                </div>

                {/* Row 2: Chủ đề & Nội dung */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Nội dung hồ sơ Seminar:</span>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>Hiển thị khi chưa có thông báo đã công bố</span>
                  </div>
                  <textarea
                    name="noiDung"
                    rows={6}
                    defaultValue={text(seminar, "NoiDung") || text(seminar, "MoTa")}
                    placeholder="Nhập chủ đề và các nội dung chính của buổi seminar..."
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13.5px",
                      lineHeight: "1.6",
                      fontFamily: "inherit",
                    }}
                  />
                </label>

                {/* Row 3: Diễn giả */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Danh sách Diễn giả (mỗi người 1 dòng):</span>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>Mỗi dòng nhập họ tên, chức danh/đơn vị</span>
                  </div>
                  <textarea
                    name="dienGia"
                    rows={5}
                    defaultValue={array(seminar.DienGia)
                      .map((item) => text(item, "hoTen"))
                      .join("\n")}
                    placeholder="VD:&#10;Bà Lê Thị Bảo Trân – Giám đốc, Công ty TNHH Phần Mềm Quốc Bảo&#10;TS. Nguyễn Hồng Bửu Long – Giảng viên Khoa CNTT, ĐH KHTN&#10;ThS. Phan Văn Vinh – Phụ trách bộ môn Khoa CNTT"
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13.5px",
                      lineHeight: "1.6",
                      fontFamily: "inherit",
                    }}
                  />
                </label>

                {/* Row 4: Lịch trình chương trình (Agenda) */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Lịch trình chương trình chi tiết (Timeline):</span>
                    <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 500 }}>
                      Định dạng: <code>thời gian | nội dung | phụ trách</code>
                    </span>
                  </div>
                  <textarea
                    name="chuongTrinh"
                    rows={8}
                    defaultValue={array(seminar.ChuongTrinh)
                      .map((item) =>
                        [text(item, "thoiGian"), text(item, "noiDung"), text(item, "phuTrach") || text(item, "dvChuTri")]
                          .filter(Boolean)
                          .join(" | ")
                      )
                      .join("\n")}
                    placeholder="VD:&#10;07:30 – 07:45 | Ổn định, điểm danh sinh viên tham gia đầu giờ | Ban tổ chức & CLB Học thuật&#10;07:45 – 08:00 | Văn nghệ chào mừng | ThS. Nguyễn Đình Hữu&#10;08:00 – 08:05 | Tuyên bố lý do và giới thiệu đại biểu | MC chương trình&#10;08:05 – 08:15 | Phát biểu khai mạc buổi Seminar | Đại diện BCN Khoa CNTT&#10;08:15 – 10:30 | Báo cáo chuyên đề và chia sẻ kinh nghiệm | Diễn giả khách mời&#10;10:30 – 11:15 | Tọa đàm hỏi đáp, định hướng nghề nghiệp | Diễn giả & Sinh viên&#10;11:15 – 11:30 | Bế mạc, trao hoa tri ân và điểm danh cuối giờ | BCN Khoa & BTC"
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      fontFamily: "monospace",
                    }}
                  />
                </label>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "8px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                  }}
                >
                  {busy ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* POPUP MODAL: TẠO SEMINAR MỚI */}
      {isCreateModalOpen && (
        <div
          onClick={() => setIsCreateModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "860px",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 4px", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>➕</span>
                  <span>Lập buổi Seminar học thuật mới</span>
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Lưu bản nháp seminar và thiết lập chương trình.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: "16px",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={createSeminar} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div
                style={{
                  padding: "24px",
                  overflowY: "auto",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {/* Row 1: Tên hoạt động & Chủ đề */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Tên hoạt động Seminar: <span style={{ color: "#dc2626" }}>*</span></span>
                    <input
                      name="tenHoatDong"
                      required
                      placeholder="VD: Seminar Chuyên đề AI và Khởi nghiệp..."
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Chủ đề chính:</span>
                    <input
                      name="chuDe"
                      placeholder="VD: Chuyên đề định hướng công nghệ..."
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                    />
                  </label>
                </div>

                {/* Row 2: Thời gian bắt đầu, kết thúc, hạn đăng ký */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Thời gian bắt đầu: <span style={{ color: "#dc2626" }}>*</span></span>
                    <input
                      type="datetime-local"
                      name="tgBatDau"
                      required
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Thời gian kết thúc: <span style={{ color: "#dc2626" }}>*</span></span>
                    <input
                      type="datetime-local"
                      name="tgKetThuc"
                      required
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Hạn đăng ký:</span>
                    <input
                      type="datetime-local"
                      name="hanDangKy"
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    />
                  </label>
                </div>

                {/* Row 3: Địa điểm, Đơn vị chủ trì, Số lượng */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "14px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Địa điểm tổ chức:</span>
                    <input
                      name="diaDiem"
                      defaultValue="Trung tâm thư viện F401, trường Đại học Công Thương TP. HCM"
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Đơn vị chủ trì:</span>
                    <input
                      name="dvChuTri"
                      defaultValue="Khoa Công nghệ Thông tin"
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                    <span>Dự kiến tham dự:</span>
                    <input
                      type="number"
                      name="slToiDa"
                      defaultValue={150}
                      min={10}
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px" }}
                    />
                  </label>
                </div>

                {/* Row 4: Nội dung tóm tắt */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                  <span>Chủ đề & Nội dung Seminar:</span>
                  <textarea
                    name="noiDung"
                    rows={4}
                    placeholder="Nhập nội dung các chuyên đề, mục tiêu và chia sẻ trong buổi seminar..."
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13.5px",
                      lineHeight: "1.6",
                      fontFamily: "inherit",
                    }}
                  />
                </label>

                {/* Row 5: Diễn giả */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Danh sách Diễn giả (mỗi người 1 dòng):</span>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>Định dạng: Họ tên – Chức danh, Đơn vị</span>
                  </div>
                  <textarea
                    name="dienGia"
                    rows={3}
                    placeholder="VD:&#10;Bà Lê Thị Bảo Trân – Giám đốc, Công ty TNHH Phần Mềm Quốc Bảo&#10;TS. Nguyễn Hồng Bửu Long – Giảng viên Khoa CNTT"
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      fontFamily: "inherit",
                    }}
                  />
                </label>

                {/* Row 6: Chương trình timeline */}
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Chương trình chi tiết (Timeline):</span>
                    <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 500 }}>
                      Định dạng: <code>thời gian | nội dung | phụ trách</code>
                    </span>
                  </div>
                  <textarea
                    name="chuongTrinh"
                    rows={4}
                    placeholder="VD:&#10;07:30 – 07:45 | Ổn định và điểm danh sinh viên | Ban tổ chức&#10;07:45 – 08:00 | Khai mạc và phát biểu | BCN Khoa&#10;08:00 – 10:30 | Báo cáo chuyên đề | Diễn giả"
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      fontFamily: "monospace",
                    }}
                  />
                </label>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 24px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "8px",
                    background: "#059669",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(5,150,105,0.25)",
                  }}
                >
                  {busy ? "Đang tạo…" : "➕ Tạo Seminar mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
