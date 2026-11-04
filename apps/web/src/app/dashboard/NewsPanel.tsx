"use client";

import { useEffect, useState, useRef, useMemo, type FormEvent } from "react";
import Link from "next/link";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;
const text = (row: Row | null | undefined, key: string) => String(row?.[key] ?? "");

function parseArticleContent(raw: string): { text: string; pdfData?: string; pdfName?: string; pdfSize?: number; image?: string } {
  if (!raw) return { text: "" };
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && (trimmed.includes('"pdfData"') || trimmed.includes('"image"') || trimmed.includes('"isPdf"'))) {
    try {
      const obj = JSON.parse(trimmed);
      return {
        text: obj.text || "",
        pdfData: obj.pdfData,
        pdfName: obj.pdfName || "tai-lieu.pdf",
        pdfSize: obj.pdfSize,
        image: obj.image,
      };
    } catch {
      // not json
    }
  }
  return { text: raw };
}

function formatFileSize(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


function formatDateVn(val: unknown): string {
  if (!val) return "Mới cập nhật";
  const d = new Date(String(val));
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const readNews = () =>
  Promise.all([
    workflowRequest<Row[]>("/news").catch(() => []),
    workflowRequest<Row[]>("/news/activities").catch(() => []),
    workflowRequest<Row[]>("/notifications/mine").catch(() => []),
    workflowRequest<Row[]>("/activities").catch(() => []),
    workflowRequest<Row[]>("/registrations/my-registrations").catch(() => []),
  ]);

export interface NewsPanelProps {
  manage?: boolean;
  user?: AuthUser;
  onNavigate?: (section: string, query?: string) => void;
}

export default function NewsPanel({ manage = false, user, onNavigate }: NewsPanelProps) {
  const isStudent = user?.roles?.includes("SINHVIEN");
  const [apiNews, setApiNews] = useState<Row[]>([]);
  const [activities, setActivities] = useState<Row[]>([]);
  const [inbox, setInbox] = useState<Row[]>([]);
  const [allActivities, setAllActivities] = useState<Row[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Row[]>([]);
  const [registerBusy, setRegisterBusy] = useState(false);

  const [editor, setEditor] = useState<Row | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Row | null>(null);
  const [showAllNotifs, setShowAllNotifs] = useState(false);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("Tất cả");
  const [statusFilter, setStatusFilter] = useState("Tất cả");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [inputMode, setInputMode] = useState<"text" | "pdf">("text");
  const [selectedMaHD, setSelectedMaHD] = useState<string>("");
  const [articleTitle, setArticleTitle] = useState<string>("");
  const [manualText, setManualText] = useState<string>("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string>("");
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pdfFileSize, setPdfFileSize] = useState<number>(0);
  const [previewPdf, setPreviewPdf] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customImage, setCustomImage] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  function openEditor(art?: Row) {
    if (art) {
      setEditor(art);
      setSelectedMaHD(text(art, "MaHD"));
      setArticleTitle(text(art, "TieuDe"));
      const parsed = parseArticleContent(text(art, "NoiDung"));
      if (parsed.pdfData) {
        setInputMode("pdf");
        setPdfDataUrl(parsed.pdfData);
        setPdfFileName(parsed.pdfName || "tai-lieu.pdf");
        setPdfFileSize(parsed.pdfSize || 0);
        setManualText(parsed.text);
      } else {
        setInputMode("text");
        setPdfDataUrl("");
        setPdfFileName("");
        setPdfFileSize(0);
        setManualText(parsed.text);
      }
      setCustomImage(parsed.image || text(art, "HinhAnh") || "");
    } else {
      setEditor({});
      setSelectedMaHD("");
      setArticleTitle("");
      setInputMode("text");
      setPdfDataUrl("");
      setPdfFileName("");
      setPdfFileSize(0);
      setManualText("");
      setCustomImage("");
    }
    setPdfFile(null);
    setPreviewPdf(false);
    setIsEditorOpen(true);
  }

  function handlePdfSelect(f: File) {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Vui lòng chọn tệp định dạng PDF (.pdf)");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("Dung lượng tệp PDF không được vượt quá 25MB");
      return;
    }
    setPdfFile(f);
    setPdfFileName(f.name);
    setPdfFileSize(f.size);
    if (!articleTitle.trim()) {
      const cleanName = f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      setArticleTitle(cleanName);
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setPdfDataUrl(res);
    };
    reader.onerror = () => {
      setError("Không đọc được tệp PDF");
    };
    reader.readAsDataURL(f);
  }

  async function load() {
    const [articles, choices, messages, acts, mine] = await readNews();
    setApiNews(articles);
    setActivities(choices);
    setInbox(messages);
    setAllActivities(acts);
    setMyRegistrations(mine);
  }

  useEffect(() => {
    let active = true;
    void readNews()
      .then(([articles, choices, messages, acts, mine]) => {
        if (active) {
          setApiNews(articles);
          setActivities(choices);
          setInbox(messages);
          setAllActivities(acts);
          setMyRegistrations(mine);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không tải được tin");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleQuickRegister(maHD: number) {
    if (!maHD) return;
    setRegisterBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await workflowRequest<{ message?: string }>("/registrations/individual", {
        method: "POST",
        body: { maHD, hinhThuc: "Tham gia" },
      });
      setNotice(res?.message || "Đăng ký tham dự seminar thành công! Vé tham dự và mã QR điểm danh của bạn đã sẵn sàng.");
      const mine = await workflowRequest<Row[]>("/registrations/my-registrations").catch(() => []);
      setMyRegistrations(mine);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng ký không thành công");
    } finally {
      setRegisterBusy(false);
    }
  }

  // Filter articles based on real database records
  const visible = apiNews.filter((article) => {
    const loai = text(article, "LoaiHoatDong").toLowerCase();
    const matchesKind =
      kind === "Tất cả" ||
      (kind === "Seminar" && loai.includes("seminar")) ||
      (kind === "Cuộc thi" && (loai.includes("cuộc thi") || loai.includes("cuoc thi")));

    const searchTarget = `${text(article, "TieuDe")} ${text(article, "TenHoatDong")} ${parseArticleContent(text(article, "NoiDung")).text}`.toLowerCase();
    const matchesQuery = searchTarget.includes(query.trim().toLowerCase());

    const matchesStatus = manage
      ? (statusFilter === "Tất cả" || article.TrangThai === statusFilter)
      : (article.TrangThai === "Đã công bố");

    return matchesKind && matchesQuery && matchesStatus;
  });

  // Announcements to display in the right column "THÔNG BÁO"
  // Combine inbox notifications with published news so announcements are always available
  const mergedNotifs = useMemo(() => {
    const list: Row[] = [...inbox];
    const seenTitles = new Set(list.map((item) => text(item, "TieuDe").trim().toLowerCase()));

    // Also include published news/announcements if not already in list
    for (const art of apiNews) {
      if (art.TrangThai === "Đã công bố") {
        const titleLower = text(art, "TieuDe").trim().toLowerCase();
        if (!seenTitles.has(titleLower)) {
          seenTitles.add(titleLower);
          list.push({
            MaThongBao: art.MaTin,
            TieuDe: art.TieuDe,
            NoiDung: art.NoiDung,
            GuiLuc: art.CongBoLuc || art.NgayTao,
            Loai: art.LoaiHoatDong || "Thông báo",
            MaHD: art.MaHD,
          });
        }
      }
    }
    return list;
  }, [inbox, apiNews]);

  const displayNotifs = showAllNotifs ? mergedNotifs : mergedNotifs.slice(0, 5);

  // Extract upcoming events from real database activities that have schedule/date and approved detailed plan
  const realEvents = allActivities
    .filter(
      (a) =>
        Boolean(a.ThoiGianBatDau || a.TgDuKien) &&
        Boolean(a.MaKeHoach) &&
        (a.TrangThaiKeHoach === "Đã duyệt" ||
          a.TrangThaiKeHoach === "Đã công bố" ||
          Boolean(a.CongBoLuc) ||
          a.TrangThai === "Đã công bố")
    )
    .slice(0, 4)
    .map((a) => {
      const d = new Date(String(a.ThoiGianBatDau || a.TgDuKien));
      const isValid = !isNaN(d.getTime());
      return {
        id: String(a.MaHD),
        ngay: isValid ? String(d.getDate()).padStart(2, "0") : "—",
        thang: isValid ? `Th${d.getMonth() + 1}` : "—",
        tieuDe: text(a, "TenHoatDong"),
        thoiGian: isValid
          ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
          : "Chưa cập nhật",
        diaDiem: text(a, "DiaDiem") || "Khoa CNTT",
        loai: text(a, "LoaiHoatDong") || "Học thuật",
      };
    });

  function getArticleImage(article: Row, index: number): string {
    const contentObj = parseArticleContent(text(article, "NoiDung"));
    if (contentObj.image) return contentObj.image;

    const img = text(article, "HinhAnh");
    if (img && (img.startsWith("/") || img.startsWith("http") || img.startsWith("data:image/"))) return img;

    const t = text(article, "TieuDe").toUpperCase();
    const loai = text(article, "LoaiHoatDong").toUpperCase();

    // Specific conference or achievements
    if (t.includes("FAIR") || t.includes("BẾ MẠC")) return "/images/news-fair-2026.svg";
    if (t.includes("IEEE") || t.includes("TKDE") || t.includes("NGUYỄN VĂN LẼ")) return "/images/news-ieee-tkde.svg";
    if (t.includes("MAVERICKS") || t.includes("AREA 303") || t.includes("TOP 2") || t.includes("BUFFALO")) return "/images/news-mavericks.svg";

    // Academic Plan or General Announcement or Document with PDF
    if (
      Boolean(contentObj.pdfData) ||
      t.includes("KẾ HOẠCH") ||
      t.includes("THÔNG BÁO") ||
      loai.includes("KẾ HOẠCH") ||
      t.includes("QUYẾT ĐỊNH") ||
      t.includes("HỌC THUẬT")
    ) {
      return "/images/news-plan-cover.svg";
    }

    // Competitions
    if (loai.includes("CUỘC THI") || t.includes("CUỘC THI") || t.includes("THI")) {
      return "/images/news-competition-cover.svg";
    }

    // Seminars / Workshops
    if (loai.includes("SEMINAR") || t.includes("SEMINAR") || t.includes("WORKSHOP") || t.includes("TỌA ĐÀM") || t.includes("CHUYÊN ĐỀ")) {
      return "/images/news-kse-2026.svg";
    }

    return "/images/news-plan-cover.svg";
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const maHDVal = selectedMaHD ? Number(selectedMaHD) : (editor?.MaHD ? Number(editor.MaHD) : undefined);
      const titleVal = articleTitle.trim();
      if (!titleVal) {
        throw new Error("Vui lòng nhập tiêu đề bản tin");
      }

      let contentPayload = "";
      if (inputMode === "pdf" && pdfDataUrl) {
        contentPayload = JSON.stringify({
          isPdf: true,
          pdfName: pdfFileName || "tai-lieu.pdf",
          pdfSize: pdfFileSize,
          pdfData: pdfDataUrl,
          text: manualText.trim(),
          image: customImage || undefined,
        });
      } else {
        if (!manualText.trim()) {
          throw new Error("Vui lòng nhập nội dung bản tin hoặc tải lên file PDF");
        }
        if (customImage) {
          contentPayload = JSON.stringify({
            isPdf: false,
            text: manualText.trim(),
            image: customImage,
          });
        } else {
          contentPayload = manualText.trim();
        }
      }

      await workflowRequest<Row>(editor?.MaTin ? `/news/${editor.MaTin}` : "/news", {
        method: editor?.MaTin ? "PUT" : "POST",
        body: {
          maHD: maHDVal,
          tieuDe: titleVal,
          noiDung: contentPayload,
        },
      });
      setIsEditorOpen(false);
      setEditor(null);
      await load();
      setNotice("Đã lưu bản tin thành công. Chọn Đăng tin khi nội dung đã sẵn sàng.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được tin");
    } finally {
      setBusy(false);
    }
  }

  async function status(article: Row, value: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await workflowRequest(`/news/${article.MaTin}/status`, { method: "PATCH", body: { trangThai: value } });
      await load();
      setNotice(value === "Đã công bố" ? "Đã đăng tin thành công." : "Đã ẩn tin.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đổi được trạng thái tin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ width: "100%", margin: 0, padding: "8px 0 40px" }}>
      {error && <NoticeDialog kind="error" message={error} onClose={() => setError("")} />}
      {notice && <NoticeDialog kind="success" message={notice} onClose={() => setNotice("")} />}

      {/* Top Filter & Search Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
          background: "#ffffff",
          padding: "14px 24px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Category Filter Pills */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {manage && (
            <div style={{ display: "inline-flex", gap: "5px", marginRight: "12px", paddingRight: "12px", borderRight: "1px solid #e2e8f0" }}>
              {["Tất cả", "Đã công bố", "Dự thảo", "Đã ẩn"].map((st) => {
                const active = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "16px",
                      border: active ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                      background: active ? "#eff6ff" : "#ffffff",
                      color: active ? "#1d4ed8" : "#64748b",
                      fontWeight: active ? 700 : 500,
                      fontSize: "12.5px",
                      cursor: "pointer",
                    }}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          )}
          {["Tất cả", "Seminar", "Cuộc thi"].map((tab) => {
            const active = kind === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setKind(tab)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "20px",
                  border: active ? "1.5px solid #dc2626" : "1px solid #e2e8f0",
                  background: active ? "#fef2f2" : "#ffffff",
                  color: active ? "#dc2626" : "#475569",
                  fontWeight: active ? 700 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Search & Compose Action */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "14px" }}>
              🔍
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm tin tức, hoạt động..."
              style={{
                padding: "7px 12px 7px 32px",
                borderRadius: "20px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                width: "240px",
                outline: "none",
                background: "#f8fafc",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {manage && (
            <button
              type="button"
              disabled={busy}
              onClick={() => openEditor()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 16px",
                borderRadius: "20px",
                background: "#dc2626",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
              }}
            >
              <span>✍️</span>
              <span>Soạn bản tin</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Layout: 1 cột cho QL Tin tức & thông báo, 2 cột cho Tin tức công cộng */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: manage ? "1fr" : "minmax(0, 1fr) 360px",
          gap: "28px",
          alignItems: "start",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT COLUMN: TIN TỨC HỌC THUẬT OR ARTICLE DETAIL */}
        <div style={{ background: "#ffffff", padding: "24px 28px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          {selectedArticle ? (
            <div>
              {/* Back navigation */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.color = "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.color = "#334155";
                  }}
                >
                  <span>←</span>
                  <span>Quay lại danh sách tin tức</span>
                </button>

                {manage && (
                  <button
                    type="button"
                    onClick={() => openEditor(selectedArticle)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#334155",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✏️ Sửa tin này
                  </button>
                )}
              </div>

              {/* 1. Tiêu đề */}
              <h1
                style={{
                  margin: "0 0 14px 0",
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#0f172a",
                  lineHeight: "1.35",
                }}
              >
                {text(selectedArticle, "TieuDe")}
              </h1>

              {/* 2. Ngày đăng */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  fontSize: "13px",
                  color: "#64748b",
                  marginBottom: "20px",
                  paddingBottom: "14px",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🗓️</span>
                  <span>Ngày đăng: <strong>{formatDateVn(selectedArticle.CongBoLuc || selectedArticle.NgayTao)}</strong></span>
                </div>
                {Boolean(selectedArticle.LoaiHoatDong) && (
                  <span
                    style={{
                      background: "#f1f5f9",
                      color: "#475569",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                    }}
                  >
                    {text(selectedArticle, "LoaiHoatDong")}
                  </span>
                )}
                {Boolean(selectedArticle.TrangThai) && (
                  <span
                    style={{
                      background: selectedArticle.TrangThai === "Đã công bố" ? "#ecfdf5" : "#fff7ed",
                      color: selectedArticle.TrangThai === "Đã công bố" ? "#047857" : "#c2410c",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                    }}
                  >
                    {text(selectedArticle, "TrangThai")}
                  </span>
                )}
              </div>

              {/* ACTION BANNER: Đăng ký tham gia Seminar / Hoạt động */}
              {(() => {
                const maHD = Number(selectedArticle.MaHD);
                if (!maHD) return null;
                const linkedAct = allActivities.find((a) => Number(a.MaHD) === maHD);
                if (!linkedAct) return null;
                const isApprovedPlan = Boolean(
                  linkedAct.MaKeHoach &&
                    (linkedAct.TrangThaiKeHoach === "Đã duyệt" ||
                      linkedAct.TrangThaiKeHoach === "Đã công bố" ||
                      Boolean(linkedAct.CongBoLuc) ||
                      linkedAct.TrangThai === "Đã công bố")
                );
                if (!isApprovedPlan) return null;

                const isRegistered = myRegistrations.some((r) => Number(r.MaHD) === maHD);
                const isCompetition = text(linkedAct, "LoaiHoatDong") === "Cuộc thi";

                return (
                  <div
                    style={{
                      background: isRegistered ? "#f0fdf4" : "#eff6ff",
                      border: isRegistered ? "1.5px solid #86efac" : "1.5px solid #bfdbfe",
                      borderRadius: "12px",
                      padding: "18px 22px",
                      marginBottom: "24px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "16px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: isRegistered ? "#dcfce7" : "#dbeafe",
                            color: isRegistered ? "#15803d" : "#1d4ed8",
                          }}
                        >
                          {isCompetition ? "🏆 CUỘC THI HỌC THUẬT" : "🎤 SEMINAR HỌC THUẬT"}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: "#fffbeb",
                            color: "#b45309",
                            border: "1px solid #fde68a",
                          }}
                        >
                          ⭐ {isCompetition ? "+5 Điểm rèn luyện" : "+3 Điểm rèn luyện"}
                        </span>
                      </div>

                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                        {text(linkedAct, "TenHoatDong")}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "12.5px", color: "#475569" }}>
                        <span>
                          📅 <strong>Thời gian:</strong> {text(linkedAct, "ThoiGianSeminar") || formatDateVn(linkedAct.ThoiGianBatDau || linkedAct.TgDuKien)}
                        </span>
                        <span>
                          📍 <strong>Địa điểm:</strong> {text(linkedAct, "DiaDiem") || "Trung tâm thư viện F401, trường Đại học Công Thương Thành phố Hồ Chí Minh"}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isStudent ? (
                        isRegistered ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                fontSize: "13px",
                                fontWeight: 700,
                                color: "#15803d",
                                background: "#dcfce7",
                                padding: "8px 14px",
                                borderRadius: "8px",
                              }}
                            >
                              ✓ Bạn đã đăng ký tham gia
                            </span>
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate("registrations")}
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: "8px",
                                  background: "#ffffff",
                                  color: "#15803d",
                                  border: "1.5px solid #86efac",
                                  fontWeight: 700,
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                🎫 Xem vé & QR điểm danh
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              disabled={registerBusy}
                              onClick={() => void handleQuickRegister(maHD)}
                              style={{
                                padding: "10px 20px",
                                borderRadius: "8px",
                                background: "#2563eb",
                                color: "#ffffff",
                                border: "none",
                                fontWeight: 700,
                                fontSize: "14px",
                                cursor: "pointer",
                                boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span>👉</span>
                              <span>{registerBusy ? "Đang xử lý…" : "Đăng ký tham dự ngay"}</span>
                            </button>
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate("registrations")}
                                style={{
                                  padding: "9px 14px",
                                  borderRadius: "8px",
                                  background: "#ffffff",
                                  color: "#475569",
                                  border: "1px solid #cbd5e1",
                                  fontWeight: 600,
                                  fontSize: "13px",
                                  cursor: "pointer",
                                }}
                              >
                                Cổng đăng ký ➔
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate("attendance")}
                            style={{
                              padding: "9px 16px",
                              borderRadius: "8px",
                              background: "#ffffff",
                              color: "#2563eb",
                              border: "1.5px solid #bfdbfe",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                            }}
                          >
                            📋 Quản lý điểm danh hoạt động
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 3. Bản PDF / Nội dung */}
              {(() => {
                const articleContent = parseArticleContent(text(selectedArticle, "NoiDung"));
                return (
                  <div>
                    {Boolean(articleContent.text) &&
                      !articleContent.text.startsWith("Tài liệu thông báo:") &&
                      !articleContent.text.includes("[Tài liệu kế hoạch PDF") && (
                      <div
                        style={{
                          fontSize: "15px",
                          lineHeight: "1.7",
                          color: "#334155",
                          whiteSpace: "pre-line",
                          marginBottom: articleContent.pdfData ? "20px" : "12px",
                          background: articleContent.pdfData ? "#f8fafc" : "transparent",
                          padding: articleContent.pdfData ? "14px 18px" : "0",
                          borderRadius: "8px",
                          border: articleContent.pdfData ? "1px solid #e2e8f0" : "none",
                        }}
                      >
                        {articleContent.text}
                      </div>
                    )}

                    {articleContent.pdfData ? (
                      <div
                        style={{
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          overflow: "hidden",
                          background: "#ffffff",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        }}
                      >
                        {/* PDF Toolbar */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "12px",
                            padding: "12px 18px",
                            background: "#f1f5f9",
                            borderBottom: "1px solid #cbd5e1",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "24px" }}>📄</span>
                            <div>
                              <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>
                                {articleContent.pdfName || "Tài liệu đính kèm.pdf"}
                              </strong>
                              <small style={{ color: "#64748b", fontSize: "12px" }}>
                                {formatFileSize(articleContent.pdfSize) || "Tài liệu PDF"}
                              </small>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "8px" }}>
                            <a
                              href={articleContent.pdfData}
                              download={articleContent.pdfName || "tai-lieu.pdf"}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "7px 14px",
                                borderRadius: "6px",
                                background: "#dc2626",
                                color: "#ffffff",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: "13px",
                              }}
                            >
                              <span>📥</span>
                              <span>Tải về PDF</span>
                            </a>
                            <a
                              href={articleContent.pdfData}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "7px 14px",
                                borderRadius: "6px",
                                background: "#ffffff",
                                color: "#334155",
                                border: "1px solid #cbd5e1",
                                textDecoration: "none",
                                fontWeight: 600,
                                fontSize: "13px",
                              }}
                            >
                              <span>↗️</span>
                              <span>Mở toàn màn hình</span>
                            </a>
                          </div>
                        </div>

                        {/* Embedded PDF iframe */}
                        <iframe
                          src={articleContent.pdfData}
                          style={{
                            width: "100%",
                            height: "820px",
                            border: "none",
                            display: "block",
                          }}
                          title={articleContent.pdfName || "Tài liệu PDF"}
                        />
                      </div>
                    ) : (
                      !articleContent.text && (
                        <div
                          style={{
                            padding: "48px 24px",
                            textAlign: "center",
                            background: "#f8fafc",
                            borderRadius: "8px",
                            border: "1px dashed #cbd5e1",
                            color: "#64748b",
                          }}
                        >
                          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
                          <div style={{ fontWeight: 600 }}>Bản tin này không có tài liệu PDF đính kèm</div>
                        </div>
                      )
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {/* Header with Red Underline Accent (chỉ hiển thị ở Tin tức & thông báo) */}
              {!manage && (
                <div
                  style={{
                    position: "relative",
                    paddingBottom: "12px",
                    borderBottom: "2px solid #e2e8f0",
                    marginBottom: "16px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "20px",
                      fontWeight: 800,
                      color: "#1e293b",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      display: "inline-block",
                    }}
                  >
                    TIN TỨC HỌC THUẬT
                  </h2>
                  {/* Red Underline Active Bar */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      left: 0,
                      width: "90px",
                      height: "3px",
                      background: "#dc2626",
                      borderRadius: "2px",
                    }}
                  />
                </div>
              )}

              {/* News List */}
              {loading ? (
                <div style={{ padding: "30px 0", textAlign: "center", color: "#64748b" }}>
                  Đang tải danh sách tin tức...
                </div>
              ) : !visible.length ? (
                <div
                  style={{
                    padding: "48px 24px",
                    textAlign: "center",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px dashed #cbd5e1",
                    margin: "12px 0",
                  }}
                >
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>📰</div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                    {query || kind !== "Tất cả" ? "Không có tin tức phù hợp với tìm kiếm" : "Chưa có bản tin học thuật nào"}
                  </div>
                  <p style={{ fontSize: "13.5px", color: "#64748b", margin: "0 auto 16px", maxWidth: "420px", lineHeight: "1.5" }}>
                    {query || kind !== "Tất cả"
                      ? "Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục Tất cả."
                      : "Các bản tin thông báo về seminar và cuộc thi học thuật sẽ được hiển thị tại đây sau khi Ban tổ chức công bố."}
                  </p>
                  {manage && activities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openEditor()}
                      style={{
                        padding: "8px 18px",
                        borderRadius: "20px",
                        background: "#dc2626",
                        color: "#ffffff",
                        border: "none",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      ✍️ Soạn bản tin ngay
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {visible.map((article, idx) => {
                    const imgUrl = getArticleImage(article, idx);
                    const isManaged = manage || Boolean(article.CanManage);
                    return (
                      <article
                        key={text(article, "MaTin") || idx}
                        onClick={() => setSelectedArticle(article)}
                        style={{
                          display: "flex",
                          gap: "20px",
                          padding: "16px 14px",
                          borderRadius: "10px",
                          border: "1px solid #f1f5f9",
                          marginBottom: "12px",
                          alignItems: "flex-start",
                          cursor: "pointer",
                          background: "#ffffff",
                          transition: "all 0.2s ease",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.06)";
                          e.currentTarget.style.borderColor = "#cbd5e1";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02)";
                          e.currentTarget.style.borderColor = "#f1f5f9";
                        }}
                      >
                        {/* Left: Thumbnail Image */}
                        <div
                          onClick={() => setSelectedArticle(article)}
                          style={{
                            width: "230px",
                            minWidth: "230px",
                            height: "140px",
                            borderRadius: "8px",
                            overflow: "hidden",
                            position: "relative",
                            background: "#0f172a",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt={text(article, "TieuDe")}
                            onError={(e) => {
                              e.currentTarget.src = "/images/news-fair-2026.svg";
                            }}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                              transition: "transform 0.3s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                          />
                        </div>

                        {/* Right: Article Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3
                            onClick={() => setSelectedArticle(article)}
                            style={{
                              margin: "0 0 8px 0",
                              fontSize: "19px",
                              fontWeight: 800,
                              color: "#1e293b",
                              lineHeight: "1.45",
                              cursor: "pointer",
                              transition: "color 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#1e293b")}
                          >
                            {text(article, "TieuDe")}
                          </h3>

                          {/* Date Row with Calendar Icon */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12.5px",
                              color: "#64748b",
                              marginBottom: "8px",
                              fontWeight: 500,
                            }}
                          >
                            <span>🗓️</span>
                            <span>{formatDateVn(article.CongBoLuc || article.NgayTao)}</span>
                            {Boolean(article.LoaiHoatDong) && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                }}
                              >
                                {text(article, "LoaiHoatDong")}
                              </span>
                            )}
                            {isManaged && (
                              <span
                                style={{
                                  background: article.TrangThai === "Đã công bố" ? "#ecfdf5" : "#fff7ed",
                                  color: article.TrangThai === "Đã công bố" ? "#047857" : "#c2410c",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                }}
                              >
                                {text(article, "TrangThai")}
                              </span>
                            )}
                          </div>

                          {/* Excerpt Summary */}
                          {(() => {
                            const parsedItem = parseArticleContent(text(article, "NoiDung"));
                            const hasRealText = Boolean(
                              parsedItem.text &&
                              !parsedItem.text.startsWith("Tài liệu thông báo:") &&
                              !parsedItem.text.includes("[Tài liệu kế hoạch PDF")
                            );
                            if (!hasRealText) return null;
                            return (
                              <p
                                style={{
                                  margin: "4px 0 0 0",
                                  fontSize: "13.5px",
                                  color: "#475569",
                                  lineHeight: "1.55",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  wordBreak: "break-word",
                                }}
                              >
                                {parsedItem.text}
                              </p>
                            );
                          })()}

                          {/* Action Buttons: chỉ hiển thị trong QL Tin tức & thông báo */}
                          {manage ? (
                            <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center" }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedArticle(article);
                                }}
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: "4px",
                                  border: "1px solid #cbd5e1",
                                  background: "#f8fafc",
                                  color: "#1e293b",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#dc2626";
                                  e.currentTarget.style.color = "#ffffff";
                                  e.currentTarget.style.borderColor = "#dc2626";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#f8fafc";
                                  e.currentTarget.style.color = "#1e293b";
                                  e.currentTarget.style.borderColor = "#cbd5e1";
                                }}
                              >
                                Xem
                              </button>

                              {isManaged && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditor(article);
                                    }}
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: "4px",
                                      border: "1px solid #cbd5e1",
                                      background: "#ffffff",
                                      color: "#334155",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Sửa tin
                                  </button>
                                  {article.TrangThai !== "Đã công bố" ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void status(article, "Đã công bố");
                                      }}
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: "4px",
                                        border: "1px solid #86efac",
                                        background: "#f0fdf4",
                                        color: "#15803d",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Đăng tin
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void status(article, "Đã ẩn");
                                      }}
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: "4px",
                                        border: "1px solid #fed7aa",
                                        background: "#fff7ed",
                                        color: "#c2410c",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Ẩn tin
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: THÔNG BÁO & SỰ KIỆN (chỉ hiển thị ở Tin tức & thông báo) */}
        {!manage && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Card: THÔNG BÁO */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px 22px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                position: "relative",
                borderBottom: "2px solid #fee2e2",
                paddingBottom: "8px",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#dc2626",
                  fontSize: "15px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                THÔNG BÁO
              </h3>
              <div
                style={{
                  position: "absolute",
                  bottom: "-2px",
                  left: 0,
                  width: "60px",
                  height: "3px",
                  background: "#dc2626",
                  borderRadius: "2px",
                }}
              />
            </div>

            {/* Notification Bullet List */}
            {!mergedNotifs.length ? (
              <div
                style={{
                  padding: "24px 12px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: "13px",
                  background: "#f8fafc",
                  borderRadius: "6px",
                  border: "1px dashed #e2e8f0",
                }}
              >
                Chưa có thông báo mới.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {displayNotifs.map((item, idx) => (
                  <div
                    key={text(item, "MaThongBao") || idx}
                    onClick={() => {
                      const match = apiNews.find(
                        (art) =>
                          (text(art, "TieuDe") && text(art, "TieuDe").trim().toLowerCase() === text(item, "TieuDe").trim().toLowerCase()) ||
                          (Boolean(item.MaHD) && Number(art.MaHD) === Number(item.MaHD))
                      );
                      if (match) {
                        setSelectedArticle(match);
                      } else {
                        setSelectedArticle({
                          MaTin: item.MaThongBao,
                          TieuDe: item.TieuDe,
                          NoiDung: item.NoiDung,
                          CongBoLuc: item.GuiLuc,
                          NgayTao: item.GuiLuc,
                          LoaiHoatDong: item.Loai || "Thông báo",
                          TrangThai: "Đã công bố",
                          CanManage: false,
                        });
                      }
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                      cursor: "pointer",
                      padding: "4px 6px",
                      borderRadius: "6px",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#fef2f2";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        color: "#dc2626",
                        fontSize: "18px",
                        lineHeight: "1",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      •
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#334155",
                          lineHeight: "1.45",
                          fontWeight: 500,
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#dc2626";
                          e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#334155";
                          e.currentTarget.style.textDecoration = "none";
                        }}
                      >
                        {text(item, "TieuDe")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Xem thêm Link if more than 5 */}
            {mergedNotifs.length > 5 && (
              <div
                style={{
                  textAlign: "right",
                  marginTop: "16px",
                  paddingTop: "10px",
                  borderTop: "1px dashed #f1f5f9",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAllNotifs(!showAllNotifs)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc2626",
                    fontWeight: 700,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{showAllNotifs ? "« Thu gọn" : "» Xem thêm"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Card: SỰ KIỆN */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px 22px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                position: "relative",
                borderBottom: "2px solid #fee2e2",
                paddingBottom: "8px",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#dc2626",
                  fontSize: "15px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                SỰ KIỆN
              </h3>
              <div
                style={{
                  position: "absolute",
                  bottom: "-2px",
                  left: 0,
                  width: "50px",
                  height: "3px",
                  background: "#dc2626",
                  borderRadius: "2px",
                }}
              />
            </div>

            {/* Upcoming Events List from Real Activities */}
            {!realEvents.length ? (
              <div
                style={{
                  padding: "20px 12px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: "13px",
                  background: "#f8fafc",
                  borderRadius: "6px",
                  border: "1px dashed #e2e8f0",
                }}
              >
                Chưa có sự kiện sắp diễn ra.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {realEvents.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    {/* Calendar Date Block */}
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "8px",
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: "16px", fontWeight: 800, color: "#1d4ed8", lineHeight: 1 }}>
                        {ev.ngay}
                      </span>
                      <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#60a5fa", marginTop: "2px" }}>
                        {ev.thang}
                      </span>
                    </div>

                    {/* Event Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#1e293b",
                          lineHeight: "1.4",
                          marginBottom: "3px",
                        }}
                      >
                        {ev.tieuDe}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                        ⏰ {ev.thoiGian} · 📍 {ev.diaDiem}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px dashed #f1f5f9", textAlign: "right" }}>
              <Link
                href="/dashboard/registrations"
                style={{
                  color: "#dc2626",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  textDecoration: "none",
                }}
              >
                » Đăng ký tham gia sự kiện
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>


      {/* ARTICLE COMPOSE / EDIT MODAL */}
      {isEditorOpen && (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => {
            setIsEditorOpen(false);
            setEditor(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              maxWidth: "960px",
              width: "min(960px, 95vw)",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              border: "1px solid #cbd5e1",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 28px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#1e293b" }}>
                  {editor?.MaTin ? "Chỉnh sửa bản tin học thuật" : "Soạn bản tin học thuật mới"}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Đăng tải thông tin hoạt động, kế hoạch học thuật hoặc đính kèm tệp PDF thể lệ, quyết định
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditorOpen(false);
                  setEditor(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "18px",
                  color: "#64748b",
                  cursor: "pointer",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={save} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div
                style={{
                  padding: "24px 28px",
                  overflowY: "auto",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                {/* Activity select */}
                <label className={s.businessField}>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                    Hoạt động học thuật phụ trách (không bắt buộc)
                  </span>
                  <select
                    className={s.businessInput}
                    name="maHD"
                    value={selectedMaHD}
                    onChange={(e) => setSelectedMaHD(e.target.value)}
                    disabled={busy || Boolean(editor?.MaTin)}
                    style={{ fontSize: "13.5px", padding: "10px 14px", borderRadius: "8px" }}
                  >
                    <option value="">-- Không gắn hoạt động cụ thể (Tin tức &amp; thông báo chung) --</option>
                    {activities.map((act) => (
                      <option key={text(act, "MaHD")} value={text(act, "MaHD")}>
                        #{text(act, "MaHD")} · {text(act, "TenHoatDong")}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Title */}
                <label className={s.businessField}>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                    Tiêu đề bản tin <span style={{ color: "#dc2626" }}>*</span>
                  </span>
                  <input
                    className={s.businessInput}
                    name="tieuDe"
                    maxLength={250}
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    required
                    disabled={busy}
                    placeholder="VD: Thông báo Kế hoạch tổ chức Cuộc thi Sáng tạo trẻ năm học 2024-2025..."
                    style={{ fontSize: "14px", padding: "10px 14px", borderRadius: "8px", fontWeight: 600 }}
                  />
                </label>

                {/* Optional Custom Cover Image */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                      Ảnh bìa / Banner bản tin (tùy chọn)
                    </span>
                    {customImage && (
                      <button
                        type="button"
                        onClick={() => setCustomImage("")}
                        style={{ background: "none", border: "none", color: "#dc2626", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                      >
                        ✕ Gỡ ảnh tự tải (dùng ảnh hệ thống)
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!f.type.startsWith("image/")) {
                        setError("Vui lòng chọn tệp hình ảnh (PNG, JPG, WebP)");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setCustomImage(reader.result as string);
                      reader.readAsDataURL(f);
                    }}
                  />

                  {customImage ? (
                    <div style={{ position: "relative", width: "100%", height: "140px", borderRadius: "8px", overflow: "hidden", border: "1px solid #cbd5e1" }}>
                      <img src={customImage} alt="Banner bản tin" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        style={{ position: "absolute", bottom: "8px", right: "8px", background: "rgba(15,23,42,0.85)", color: "#fff", border: "none", borderRadius: "4px", padding: "5px 12px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                      >
                        Đổi ảnh khác
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#334155",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span>🖼️</span>
                        <span>Tải ảnh bìa tùy chỉnh...</span>
                      </button>
                      <small style={{ color: "#64748b" }}>
                        Nếu không tải ảnh, hệ thống tự động gắn ảnh bìa <strong>Kế hoạch / Thông báo chính thức</strong> đúng theo tiêu đề.
                      </small>
                    </div>
                  )}
                </div>

                {/* Mode Selector Tabs: Nhập tay hoặc Đẩy file PDF lên */}
                <div>
                  <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "8px" }}>
                    Phương thức nhập nội dung bản tin
                  </span>
                  <div
                    style={{
                      display: "inline-flex",
                      background: "#f1f5f9",
                      padding: "4px",
                      borderRadius: "8px",
                      gap: "4px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setInputMode("text")}
                      style={{
                        padding: "8px 18px",
                        borderRadius: "6px",
                        border: "none",
                        background: inputMode === "text" ? "#ffffff" : "transparent",
                        color: inputMode === "text" ? "#dc2626" : "#475569",
                        fontWeight: inputMode === "text" ? 700 : 500,
                        fontSize: "13px",
                        cursor: "pointer",
                        boxShadow: inputMode === "text" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      ✍️ Nhập văn bản trực tiếp
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("pdf")}
                      style={{
                        padding: "8px 18px",
                        borderRadius: "6px",
                        border: "none",
                        background: inputMode === "pdf" ? "#ffffff" : "transparent",
                        color: inputMode === "pdf" ? "#dc2626" : "#475569",
                        fontWeight: inputMode === "pdf" ? 700 : 500,
                        fontSize: "13px",
                        cursor: "pointer",
                        boxShadow: inputMode === "pdf" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      📄 Đẩy file PDF lên
                    </button>
                  </div>
                </div>

                {/* MODE 1: Manual typing */}
                {inputMode === "text" && (
                  <label className={s.businessField}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                        Nội dung bài viết bản tin <span style={{ color: "#dc2626" }}>*</span>
                      </span>
                      <small style={{ color: "#94a3b8" }}>{manualText.length}/30.000 ký tự</small>
                    </div>
                    <textarea
                      className={s.businessInput}
                      name="noiDung"
                      rows={12}
                      maxLength={30000}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      required={inputMode === "text"}
                      disabled={busy}
                      placeholder="Nhập nội dung bài viết, kế hoạch, thông báo chi tiết tổ chức hoạt động học thuật..."
                      style={{ fontSize: "13.5px", lineHeight: "1.6", padding: "12px 14px", borderRadius: "8px" }}
                    />
                  </label>
                )}

                {/* MODE 2: PDF Upload */}
                {inputMode === "pdf" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,application/pdf"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePdfSelect(f);
                      }}
                    />

                    {!pdfDataUrl ? (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragOver(true);
                        }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragOver(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f) handlePdfSelect(f);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: isDragOver ? "2px dashed #dc2626" : "2px dashed #cbd5e1",
                          borderRadius: "10px",
                          padding: "40px 20px",
                          textAlign: "center",
                          background: isDragOver ? "#fef2f2" : "#f8fafc",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ fontSize: "40px", marginBottom: "10px" }}>📄</div>
                        <strong style={{ display: "block", color: "#1e293b", fontSize: "15px", marginBottom: "6px" }}>
                          Kéo &amp; thả tệp PDF vào đây, hoặc bấm để chọn tệp từ máy tính
                        </strong>
                        <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                          Hỗ trợ tệp kế hoạch, thông báo, quyết định định dạng <strong>.PDF</strong> (dung lượng tối đa 25MB)
                        </p>
                      </div>
                    ) : (
                      <div
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "10px",
                          padding: "16px 20px",
                          background: "#f8fafc",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "32px" }}>📄</span>
                            <div>
                              <strong style={{ display: "block", color: "#1e293b", fontSize: "14.5px" }}>
                                {pdfFileName || "Tài liệu đính kèm.pdf"}
                              </strong>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                                <small style={{ color: "#64748b" }}>{formatFileSize(pdfFileSize)}</small>
                                <span style={{ color: "#cbd5e1" }}>•</span>
                                <span style={{ color: "#059669", fontSize: "12px", fontWeight: 600 }}>✓ Sẵn sàng tải lên</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => setPreviewPdf((prev) => !prev)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                color: "#334155",
                                fontSize: "12.5px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              {previewPdf ? "Ẩn xem trước" : "👁️ Xem trước PDF"}
                            </button>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                color: "#334155",
                                fontSize: "12.5px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Đổi tệp khác
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPdfFile(null);
                                setPdfDataUrl("");
                                setPdfFileName("");
                                setPdfFileSize(0);
                                setPreviewPdf(false);
                              }}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid #fca5a5",
                                background: "#fef2f2",
                                color: "#dc2626",
                                fontSize: "12.5px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Xóa file
                            </button>
                          </div>
                        </div>

                        {previewPdf && (
                          <div style={{ marginTop: "14px" }}>
                            <iframe
                              src={pdfDataUrl}
                              style={{
                                width: "100%",
                                height: "420px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                background: "#ffffff",
                              }}
                              title="Xem trước PDF"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Accompanying notes */}
                    <label className={s.businessField}>
                      <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#334155" }}>
                        Ghi chú tóm tắt đi kèm tài liệu PDF (tùy chọn)
                      </span>
                      <textarea
                        className={s.businessInput}
                        rows={4}
                        maxLength={5000}
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        placeholder="Nhập tóm tắt ngắn gọn hoặc thông tin bổ sung đi kèm tệp PDF..."
                        style={{ fontSize: "13.5px", lineHeight: "1.5", padding: "10px 14px", borderRadius: "8px" }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 28px",
                  borderTop: "1px solid #f1f5f9",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                  💡 Bản tin lưu ở trạng thái <strong>Dự thảo</strong>. Sau khi lưu, bạn có thể bấm <strong>Đăng tin</strong> để công bố cho sinh viên.
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setIsEditorOpen(false);
                      setEditor(null);
                    }}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      color: "#64748b",
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
                      padding: "8px 22px",
                      borderRadius: "6px",
                      background: "#dc2626",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "13.5px",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
                    }}
                  >
                    {busy ? "Đang lưu..." : "Lưu bản tin"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
